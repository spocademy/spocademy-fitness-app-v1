import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, RotateCcw, Play, ArrowLeft, Volume2, VolumeX, HelpCircle, Pause, SkipForward, Star, Trophy } from 'lucide-react';

// MediaPipe Pose Detection Integration
let Pose, MediaPipeCamera, drawConnectors, drawLandmarks, POSE_CONNECTIONS, POSE_LANDMARKS;

// Load MediaPipe dynamically
const loadMediaPipe = async () => {
  if (typeof window !== 'undefined') {
    try {
      const poseModule = await import('https://cdn.skypack.dev/@mediapipe/pose');
      const cameraModule = await import('https://cdn.skypack.dev/@mediapipe/camera_utils');
      const drawingModule = await import('https://cdn.skypack.dev/@mediapipe/drawing_utils');
      
      Pose = poseModule.Pose;
      MediaPipeCamera = cameraModule.Camera;
      drawConnectors = drawingModule.drawConnectors;
      drawLandmarks = drawingModule.drawLandmarks;
      POSE_CONNECTIONS = poseModule.POSE_CONNECTIONS;
      POSE_LANDMARKS = poseModule.POSE_LANDMARKS;
      
      return true;
    } catch (error) {
      console.error('MediaPipe loading failed:', error);
      return false;
    }
  }
  return false;
};

const DailyFitnessApp = () => {
  const [tasks, setTasks] = useState({
    athletics: [
      { 
        id: 'a1', 
        name: '400m Run', 
        type: 'athletics', 
        completed: false, 
        target: 'Under 2:30 min',
        instructions: 'Run 400 meters at a steady pace. Focus on breathing rhythm and maintain consistent speed.',
        points: 3
      },
      { 
        id: 'a2', 
        name: 'High Jump Practice', 
        type: 'athletics', 
        completed: true, 
        target: '3 attempts',
        instructions: 'Practice high jump technique. Focus on approach run and takeoff timing.',
        points: 2
      }
    ],
    strength: [
      { 
        id: 's1', 
        name: 'Push-ups', 
        type: 'strength', 
        completed: false, 
        target: 20, 
        current: 0,
        instructions: 'Keep your body straight, lower chest to ground, push back up. Full range of motion.',
        points: 2
      },
      { 
        id: 's2', 
        name: 'Squats', 
        type: 'strength', 
        completed: false, 
        target: 25, 
        current: 0,
        instructions: 'Stand with feet shoulder-width apart. Lower by bending knees, keep chest up and back straight.',
        points: 2
      },
      { 
        id: 's3', 
        name: 'Jumping Jacks', 
        type: 'strength', 
        completed: false, 
        target: 30, 
        current: 0,
        instructions: 'Jump while spreading legs and raising arms overhead. Land softly and maintain rhythm.',
        points: 2
      }
    ],
    nutrition: [
      { 
        id: 'n1', 
        name: 'Drink 2L Water', 
        type: 'nutrition', 
        completed: false, 
        target: '8 glasses',
        instructions: 'Stay hydrated throughout the day. Drink water before, during, and after training.',
        points: 1
      },
      { 
        id: 'n2', 
        name: 'Protein Rich Breakfast', 
        type: 'nutrition', 
        completed: false, 
        target: '30g protein',
        instructions: 'Include eggs, dal, or milk in your breakfast. Protein helps muscle recovery.',
        points: 2
      }
    ]
  });

  const [activeExercise, setActiveExercise] = useState(null);
  const [isCamera, setIsCamera] = useState(false);
  const [currentCount, setCurrentCount] = useState(0);
  const [expandedTask, setExpandedTask] = useState(null);
  const [showRating, setShowRating] = useState(null);
  const [difficulty, setDifficulty] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);
  const [formFeedback, setFormFeedback] = useState('');
  const [mediaPipeReady, setMediaPipeReady] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const countingIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const lastPoseTime = useRef(0);
  const poseHistory = useRef([]);

  // Exercise-specific pose detection logic
  const exerciseDetectors = {
    'Push-ups': {
      detect: (landmarks) => {
        if (!landmarks) return { detected: false, feedback: 'Position yourself in frame' };
        
        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
        const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

        if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow) {
          return { detected: false, feedback: 'Keep your upper body in frame' };
        }

        // Calculate angles for push-up detection
        const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        const avgAngle = (leftArmAngle + rightArmAngle) / 2;

        // Push-up down position (arms bent)
        if (avgAngle < 90) {
          return { detected: true, phase: 'down', feedback: 'Good! Now push up' };
        }
        // Push-up up position (arms extended)
        else if (avgAngle > 160) {
          return { detected: true, phase: 'up', feedback: 'Perfect form!' };
        }
        else {
          return { detected: true, phase: 'transition', feedback: 'Keep going' };
        }
      }
    },

    'Squats': {
      detect: (landmarks) => {
        if (!landmarks) return { detected: false, feedback: 'Stand in frame' };
        
        const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
        const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
        const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
        const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
        const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];

        if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee) {
          return { detected: false, feedback: 'Keep your legs visible in frame' };
        }

        // Calculate knee angles for squat detection
        const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        const avgHipY = (leftHip.y + rightHip.y) / 2;
        const avgKneeY = (leftKnee.y + rightKnee.y) / 2;

        // Squat down position (knees bent, hips lower)
        if (leftKneeAngle < 120 && avgHipY > avgKneeY - 0.1) {
          return { detected: true, phase: 'down', feedback: 'Great squat! Now stand up' };
        }
        // Squat up position (legs extended)
        else if (leftKneeAngle > 160) {
          return { detected: true, phase: 'up', feedback: 'Perfect! Ready for next rep' };
        }
        else {
          return { detected: true, phase: 'transition', feedback: 'Keep your back straight' };
        }
      }
    },

    'Jumping Jacks': {
      detect: (landmarks) => {
        if (!landmarks) return { detected: false, feedback: 'Stand in full frame' };
        
        const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
        const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
        const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
        const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
        const nose = landmarks[POSE_LANDMARKS.NOSE];

        if (!leftWrist || !rightWrist || !leftAnkle || !rightAnkle || !nose) {
          return { detected: false, feedback: 'Keep your whole body in frame' };
        }

        const armSpread = Math.abs(leftWrist.x - rightWrist.x);
        const legSpread = Math.abs(leftAnkle.x - rightAnkle.x);
        const armsUp = (leftWrist.y + rightWrist.y) / 2 < nose.y;

        // Arms up, legs apart (jumping jack extended position)
        if (armsUp && armSpread > 0.3 && legSpread > 0.2) {
          return { detected: true, phase: 'extended', feedback: 'Great extension!' };
        }
        // Arms down, legs together (starting position)
        else if (!armsUp && armSpread < 0.2 && legSpread < 0.15) {
          return { detected: true, phase: 'closed', feedback: 'Good! Jump again' };
        }
        else {
          return { detected: true, phase: 'transition', feedback: 'Keep the rhythm' };
        }
      }
    }
  };

  // Calculate angle between three points
  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  };

  // Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      const loaded = await loadMediaPipe();
      if (loaded) {
        setMediaPipeReady(true);
      } else {
        setError({
          type: 'mediapipe',
          message: 'Failed to load MediaPipe. Some features may not work properly.',
          suggestions: ['Try refreshing the page', 'Check your internet connection', 'Use a supported browser (Chrome/Firefox)']
        });
      }
    };
    
    initMediaPipe();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Calculate progress
  const getTotalTasks = () => {
    return tasks.athletics.length + tasks.strength.length + tasks.nutrition.length;
  };

  const getCompletedTasks = () => {
    return [...tasks.athletics, ...tasks.strength, ...tasks.nutrition].filter(task => task.completed).length;
  };

  const getSectionProgress = (section) => {
    const completed = tasks[section].filter(task => task.completed).length;
    const total = tasks[section].length;
    return { completed, total };
  };

  // Toggle task completion for manual tasks
  const toggleTaskCompletion = (section, taskId) => {
    setTasks(prev => ({
      ...prev,
      [section]: prev[section].map(task => 
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    }));
  };

  // Expand/collapse task details
  const toggleTaskExpansion = (taskId) => {
    setExpandedTask(expandedTask === taskId ? null : taskId);
  };

  // Text-to-speech for counting and feedback
  const speak = (text, rate = 0.8) => {
    if ('speechSynthesis' in window && audioEnabled) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text.toString());
      utterance.rate = rate;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  // MediaPipe pose detection callback
  const onResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.poseLandmarks && activeExercise) {
      // Draw pose landmarks and connections
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
      drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
      
      // Exercise-specific detection
      const detector = exerciseDetectors[activeExercise.name];
      if (detector) {
        const detection = detector.detect(results.poseLandmarks);
        
        setPoseDetected(detection.detected);
        setFormFeedback(detection.feedback);
        
        // Count reps based on exercise phases
        if (detection.detected && detection.phase) {
          handleRepCounting(detection.phase);
        }
      }
    } else {
      setPoseDetected(false);
      setFormFeedback('Position yourself in frame');
    }
  };

  // Handle rep counting logic
  const handleRepCounting = (phase) => {
    const now = Date.now();
    const timeSinceLastPose = now - lastPoseTime.current;
    
    // Add current phase to history
    if (timeSinceLastPose > 200) { // Debounce rapid changes
      poseHistory.current.push(phase);
      
      // Keep only last 10 poses for analysis
      if (poseHistory.current.length > 10) {
        poseHistory.current.shift();
      }
      
      // Count rep based on exercise-specific phase transitions
      if (shouldCountRep(activeExercise.name, poseHistory.current)) {
        incrementRep();
        poseHistory.current = []; // Clear history after counting
      }
      
      lastPoseTime.current = now;
    }
  };

  // Exercise-specific rep counting logic
  const shouldCountRep = (exerciseName, history) => {
    if (history.length < 4) return false;
    
    switch (exerciseName) {
      case 'Push-ups':
        // Count when transitioning from down -> up -> down
        const hasDownUp = history.includes('down') && history.includes('up');
        const lastPhase = history[history.length - 1];
        const secondLastPhase = history[history.length - 2];
        return hasDownUp && lastPhase === 'up' && secondLastPhase !== 'up';
        
      case 'Squats':
        // Count when transitioning from up -> down -> up
        const hasUpDown = history.includes('up') && history.includes('down');
        const lastSquatPhase = history[history.length - 1];
        const secondLastSquatPhase = history[history.length - 2];
        return hasUpDown && lastSquatPhase === 'up' && secondLastSquatPhase !== 'up';
        
      case 'Jumping Jacks':
        // Count when transitioning from closed -> extended -> closed
        const hasClosedExtended = history.includes('closed') && history.includes('extended');
        const lastJackPhase = history[history.length - 1];
        const secondLastJackPhase = history[history.length - 2];
        return hasClosedExtended && lastJackPhase === 'closed' && secondLastJackPhase !== 'closed';
        
      default:
        return false;
    }
  };

  // Increment rep counter
  const incrementRep = () => {
    if (!activeExercise || isPaused) return;
    
    const newCount = currentCount + 1;
    setCurrentCount(newCount);
    
    // Audio feedback
    if (audioEnabled) {
      speak(newCount.toString());
    }
    
    // Update task progress
    setTasks(prev => ({
      ...prev,
      strength: prev.strength.map(t => 
        t.id === activeExercise.id ? { ...t, current: newCount } : t
      )
    }));
    
    // Check if exercise is complete
    if (newCount >= activeExercise.target) {
      setTimeout(() => {
        completeExercise();
      }, 1000);
    }
  };

  // Complete exercise
  const completeExercise = () => {
    if (!activeExercise) return;
    
    // Mark task as completed
    setTasks(prev => ({
      ...prev,
      strength: prev.strength.map(t => 
        t.id === activeExercise.id ? { ...t, completed: true, current: activeExercise.target } : t
      )
    }));
    
    setFormFeedback('Exercise completed!');
    speak('Excellent! Exercise completed successfully!');
    
    setTimeout(() => {
      stopCamera();
      setShowRating(activeExercise.id);
    }, 2000);
  };
  // Start camera for strength exercise
  const startExercise = async (task) => {
    if (!mediaPipeReady) {
      setError({
        type: 'mediapipe',
        message: 'MediaPipe is still loading. Please wait a moment and try again.',
        suggestions: ['Wait for MediaPipe to load', 'Check your internet connection', 'Try refreshing the page']
      });
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        mediaStreamRef.current = stream;
        setActiveExercise(task);
        setCurrentCount(task.current);
        setIsCamera(true);
        setLoading(false);
        setPoseDetected(false);
        setFormFeedback('Initializing pose detection...');
        poseHistory.current = [];
        lastPoseTime.current = 0;
        
        // Initialize MediaPipe Pose
        if (Pose && MediaPipeCamera) {
          poseRef.current = new Pose({
            locateFile: (file) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
          });

          poseRef.current.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });

          poseRef.current.onResults(onResults);

          // Start camera with MediaPipe
          cameraRef.current = new MediaPipeCamera(videoRef.current, {
            onFrame: async () => {
              if (poseRef.current && videoRef.current && !isPaused) {
                await poseRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480
          });

          await cameraRef.current.start();
          setFormFeedback('Position yourself in frame');
        }
      }
    } catch (error) {
      console.error('Camera/MediaPipe error:', error);
      let errorMessage = 'Cannot access camera or initialize pose detection.';
      let suggestions = ['Check camera permissions', 'Ensure camera is not being used by another app', 'Try refreshing the page'];
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        suggestions = ['Click allow when prompted for camera access', 'Check browser camera permissions', 'Reload the page and try again'];
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
        suggestions = ['Connect a camera to your device', 'Try using a different device', 'Check if camera is properly connected'];
      }
      
      setError({
        type: 'camera',
        message: errorMessage,
        suggestions: suggestions
      });
      setLoading(false);
    }
  };

  // Stop camera and cleanup
  const stopCamera = () => {
    // Stop MediaPipe camera
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    
    // Close MediaPipe pose
    if (poseRef.current) {
      poseRef.current.close();
      poseRef.current = null;
    }
    
    // Stop media stream
    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    // Reset state
    setIsCamera(false);
    setActiveExercise(null);
    setCurrentCount(0);
    setError(null);
    setLoading(false);
    setPoseDetected(false);
    setFormFeedback('');
    setIsPaused(false);
    poseHistory.current = [];
    lastPoseTime.current = 0;
  };

  // Handle pause/resume
  const togglePause = () => {
    setIsPaused(!isPaused);
    speak(isPaused ? 'Resumed' : 'Paused');
  };

  // Skip current exercise
  const skipExercise = () => {
    if (activeExercise) {
      speak('Exercise skipped');
      stopCamera();
    }
  };

  // Handle difficulty rating
  const submitRating = (taskId, rating) => {
    setDifficulty(rating);
    // Here you would typically send this data to your backend
    console.log(`Task ${taskId} rated ${rating}/5 stars`);
    setShowRating(null);
    setDifficulty(0);
  };

  // Check if it's a rest day
  const isRestDay = getTotalTasks() === 0;

  const completedCount = getCompletedTasks();
  const totalCount = getTotalTasks();
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Rest day component
  if (isRestDay) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#4d4d4d' }}>
                Rest Day
              </h1>
              <div className="text-sm" style={{ color: '#007fff' }}>
                Training for Khed Village
              </div>
            </div>
            <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium" style={{ color: '#4d4d4d' }}>
              मराठी
            </button>
          </div>
        </div>
        <div className="text-center py-16 px-4">
          <div className="text-6xl mb-6">🏖️</div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#007fff' }}>
            Take a well-deserved rest!
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Today is your rest day. No assigned tasks - your body needs recovery time. Come back tomorrow for more training!
          </p>
        </div>
      </div>
    );
  }

  // Camera view for exercise tracking
  if (isCamera && activeExercise) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-800">
          <div className="flex items-center space-x-3">
            <button onClick={stopCamera} className="p-2 hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">{activeExercise.name}</h1>
              <div className="text-xs text-blue-300">Training for Khed Village</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 hover:bg-gray-700 rounded-lg"
            >
              {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Video Feed */}
        <div className="relative flex-1 bg-black">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div>Starting camera...</div>
              </div>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
                onLoadedData={() => setLoading(false)}
              />
              <canvas 
                ref={canvasRef} 
                className="absolute top-0 left-0 w-full h-full"
              />
              
              {/* Pose Detection Status */}
              <div className={`absolute top-4 right-4 px-3 py-2 rounded-full text-sm font-medium ${
                poseDetected 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-gray-900'
              }`}>
                {poseDetected ? '✓ Good Position' : '⚠ Adjust Position'}
              </div>
            </>
          )}
        </div>

        {/* Exercise Info */}
        <div className="p-6 bg-gray-800">
          <div className="text-center mb-4">
            <div className="text-4xl font-bold mb-2" style={{ color: '#007fff' }}>
              {currentCount}/{activeExercise.target}
            </div>
            <div className="text-gray-300">reps completed</div>
          </div>

          {/* Form Feedback */}
          {formFeedback && (
            <div className={`p-3 rounded-lg text-center mb-4 ${
              poseDetected && !formFeedback.includes('adjust') && !formFeedback.includes('Position')
                ? 'bg-green-600 text-white' 
                : 'bg-yellow-600 text-gray-900'
            }`}>
              {formFeedback}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={togglePause}
              disabled={!poseDetected}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            
            <button
              onClick={skipExercise}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <SkipForward className="w-4 h-4" />
              <span>Skip</span>
            </button>
          </div>

          {/* Progress */}
          <div className="mt-4 text-center text-gray-300 text-sm">
            {activeExercise.target - currentCount} reps remaining
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full border-2 border-red-200">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">
              {error.type === 'camera' ? '📷' : '⚠️'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {error.type === 'camera' ? 'Camera Not Available' : 'Something Went Wrong'}
            </h2>
            <p className="text-gray-600 mb-6">{error.message}</p>
            
            {error.suggestions && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Try these solutions:</h3>
                <ul className="text-sm text-gray-600 text-left space-y-1">
                  {error.suggestions.map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setError(null);
                  if (activeExercise) startExercise(activeExercise);
                }}
                className="w-full px-4 py-2 text-white rounded-lg font-medium"
                style={{ backgroundColor: '#007fff' }}
              >
                Try Again
              </button>
              <button
                onClick={() => setError(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rating modal
  if (showRating) {
    const task = [...tasks.athletics, ...tasks.strength, ...tasks.nutrition]
      .find(t => t.id === showRating);
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Excellent Work!</h2>
            <p className="text-gray-600 mb-6">
              You completed {task?.name} perfectly! Making Khed Village proud.
            </p>
            
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3">How difficult was this exercise?</h3>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setDifficulty(star)}
                    className={`text-2xl ${
                      star <= difficulty ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    <Star className="w-8 h-8 fill-current" />
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {difficulty === 0 ? 'Tap to rate' :
                 difficulty <= 2 ? 'Too easy' :
                 difficulty === 3 ? 'Just right' :
                 difficulty === 4 ? 'Challenging' : 'Very hard'}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => submitRating(showRating, difficulty)}
                disabled={difficulty === 0}
                className="w-full px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
                style={{ backgroundColor: '#007fff' }}
              >
                Continue Training
              </button>
              <button
                onClick={() => setShowRating(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium"
              >
                Skip Rating
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main daily task page
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" style={{ color: '#4d4d4d' }} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#4d4d4d' }}>
                Day 5 Plan
              </h1>
              <div className="text-sm" style={{ color: '#007fff' }}>
                Training for Khed Village
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5" style={{ color: '#007fff' }} />
              <span className="text-sm font-medium" style={{ color: '#4d4d4d' }}>
                Level 3
              </span>
            </div>
            <button className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium" style={{ color: '#4d4d4d' }}>
              मराठी
            </button>
          </div>
        </div>
        
        {/* Progress */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="#e5e7eb"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="#007fff"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - progressPercentage / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold" style={{ color: '#007fff' }}>
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-gray-600">
          Tasks Completed Today
        </p>
      </div>

      <div className="px-4 space-y-6 mt-6">
        {/* Athletics Section */}
        {tasks.athletics.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold" style={{ color: '#4d4d4d' }}>
                Athletics Training
              </h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                {getSectionProgress('athletics').completed}/{getSectionProgress('athletics').total}
              </span>
            </div>
            <div className="space-y-3">
              {tasks.athletics.map(task => (
                <div 
                  key={task.id}
                  className={`bg-white rounded-lg border-2 transition-all ${
                    task.completed 
                      ? 'border-green-200 bg-green-50' 
                      : expandedTask === task.id
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200'
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleTaskExpansion(task.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                          task.completed ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          🏃
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                          <p className="text-sm text-gray-500">Target: {task.target} • {task.points} points</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {task.completed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskCompletion('athletics', task.id);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          task.completed 
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 text-gray-400'
                        }`}>
                          {task.completed && <Check className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded content */}
                  {expandedTask === task.id && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="bg-gray-50 p-3 rounded-lg mt-3 mb-4">
                        <p className="text-sm text-gray-700">{task.instructions}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskCompletion('athletics', task.id);
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                            task.completed 
                              ? 'bg-green-600 text-white' 
                              : 'text-white'
                          }`}
                          style={{ backgroundColor: task.completed ? '#10b981' : '#007fff' }}
                        >
                          {task.completed ? (
                            <div className="flex items-center justify-center space-x-1">
                              <Check className="w-4 h-4" />
                              <span>Completed</span>
                            </div>
                          ) : (
                            'Mark Complete'
                          )}
                        </button>
                        <button
                          className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strength Section */}
        {tasks.strength.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold" style={{ color: '#4d4d4d' }}>
                Strength Training
              </h2>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                {getSectionProgress('strength').completed}/{getSectionProgress('strength').total}
              </span>
            </div>
            <div className="space-y-3">
              {tasks.strength.map(task => (
                <div 
                  key={task.id}
                  className={`bg-white rounded-lg border-2 transition-all ${
                    task.completed 
                      ? 'border-green-200 bg-green-50' 
                      : expandedTask === task.id
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200'
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => !task.completed && toggleTaskExpansion(task.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          task.completed ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                          <p className="text-sm text-gray-500">
                            {task.completed 
                              ? `Completed: ${task.current}/${task.target} • ${task.points} points`
                              : `Target: ${task.target} reps • ${task.points} points`
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          task.completed 
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 text-gray-400'
                        }`}>
                          {task.completed && <Check className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded content */}
                  {expandedTask === task.id && !task.completed && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="bg-gray-50 p-3 rounded-lg mt-3 mb-4">
                        <p className="text-sm text-gray-700">{task.instructions}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startExercise(task);
                          }}
                          className="flex-1 px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center space-x-2"
                          style={{ backgroundColor: '#007fff' }}
                        >
                          <Play className="w-4 h-4" />
                          <span>Start Camera</span>
                        </button>
                        <button className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Success banner for completed tasks */}
                  {task.completed && (
                    <div className="mx-4 mb-4 p-3 bg-green-100 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Excellent form! +{task.points} points earned
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nutrition Section */}
        {tasks.nutrition.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold" style={{ color: '#4d4d4d' }}>
                Nutrition Plan
              </h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                {getSectionProgress('nutrition').completed}/{getSectionProgress('nutrition').total}
              </span>
            </div>
            <div className="space-y-3">
              {tasks.nutrition.map(task => (
                <div 
                  key={task.id}
                  className={`bg-white rounded-lg border-2 transition-all ${
                    task.completed 
                      ? 'border-green-200 bg-green-50' 
                      : expandedTask === task.id
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200'
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleTaskExpansion(task.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                          task.completed ? 'bg-green-100 text-green-600' : 'bg-green-100 text-green-600'
                        }`}>
                          💧
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                          <p className="text-sm text-gray-500">Target: {task.target} • {task.points} points</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {task.completed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskCompletion('nutrition', task.id);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          task.completed 
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 text-gray-400'
                        }`}>
                          {task.completed && <Check className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded content */}
                  {expandedTask === task.id && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="bg-gray-50 p-3 rounded-lg mt-3 mb-4">
                        <p className="text-sm text-gray-700">{task.instructions}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskCompletion('nutrition', task.id);
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                            task.completed 
                              ? 'bg-green-600 text-white' 
                              : 'text-white'
                          }`}
                          style={{ backgroundColor: task.completed ? '#10b981' : '#007fff' }}
                        >
                          {task.completed ? (
                            <div className="flex items-center justify-center space-x-1">
                              <Check className="w-4 h-4" />
                              <span>Completed</span>
                            </div>
                          ) : (
                            'Mark Complete'
                          )}
                        </button>
                        <button className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Success banner for completed tasks */}
                  {task.completed && (
                    <div className="mx-4 mb-4 p-3 bg-green-100 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Great job! +{task.points} points earned
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyFitnessApp;