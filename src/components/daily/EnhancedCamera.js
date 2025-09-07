// src/components/daily/EnhancedCamera.js
import React, { useState, useRef, useEffect } from 'react';
import './EnhancedCamera.css';

const EnhancedCamera = ({ 
  exercise, 
  onComplete, 
  onBack, 
  isVisible,
  translations,
  currentLanguage,
  taskIndex
}) => {
  const [exerciseCount, setExerciseCount] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [exerciseStatus, setExerciseStatus] = useState('Loading...');
  const [audioContext, setAudioContext] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState('');
  
  // Detection state refs
  const hasGoneDown = useRef(false);
  const armsUp = useRef(false);
  const legsApart = useRef(false);
  const hasCompletedJump = useRef(false);
  const currentExerciseCount = useRef(0);
  const currentSetNumber = useRef(1);
  const isDetectionActive = useRef(true);
  
  // MediaPipe refs
  const videoRef = useRef();
  const canvasRef = useRef();
  const poseRef = useRef();
  const cameraRef = useRef();
  const restTimerRef = useRef();
  const overlayTimerRef = useRef();

  // Exercise data from props
  const repsPerSet = exercise?.repsPerSet || exercise?.reps || 5;
  const totalSets = exercise?.sets || 2;
  const restTimeFromExercise = exercise?.restTime || 5;
  const currentExercise = exercise?.exerciseType || 'squats';

  console.log('Exercise data:', { exercise, currentExercise, repsPerSet, totalSets });

  // Initialize audio
  useEffect(() => {
    const initAudio = () => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        setAudioContext(context);
      } catch (error) {
        console.warn('Audio context failed:', error);
      }
    };
    
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Main effect for starting exercise
  useEffect(() => {
    if (isVisible && exercise) {
      console.log('Starting exercise setup...');
      
      // Reset states
      hasGoneDown.current = false;
      armsUp.current = false;
      legsApart.current = false;
      hasCompletedJump.current = false;
      currentExerciseCount.current = 0;
      currentSetNumber.current = 1;
      isDetectionActive.current = true;
      
      setExerciseCount(0);
      setCurrentSet(1);
      setIsResting(false);
      setShowOverlay(false);
      
      const checkAndStart = () => {
        if (typeof window.Pose !== 'undefined' && typeof window.Camera !== 'undefined') {
          console.log('MediaPipe available, starting camera...');
          startCamera();
        } else {
          console.log('MediaPipe not ready, retrying...');
          setExerciseStatus('Loading MediaPipe...');
          setTimeout(checkAndStart, 1000);
        }
      };
      
      checkAndStart();
    }
    
    return () => {
      cleanup();
    };
  }, [isVisible, exercise]);

  const startCamera = async () => {
    try {
      setExerciseStatus('Starting camera...');
      
      // Initialize Pose
      const pose = new window.Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
        }
      });
      
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      pose.onResults(onResults);
      poseRef.current = pose;
      
      // Get camera stream
      setExerciseStatus('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      // Setup video
      const videoElement = videoRef.current;
      if (!videoElement) throw new Error('Video element not found');
      
      videoElement.srcObject = stream;
      
      // Wait for video to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 10000);
        
        const handleLoaded = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        videoElement.addEventListener('loadeddata', handleLoaded, { once: true });
        videoElement.addEventListener('canplay', handleLoaded, { once: true });
        
        if (videoElement.readyState >= 2) handleLoaded();
      });
      
      // Start MediaPipe camera
      setExerciseStatus('Initializing detection...');
      const camera = new window.Camera(videoElement, {
        onFrame: async () => {
          if (poseRef.current && isDetectionActive.current && !isResting) {
            try {
              await poseRef.current.send({ image: videoElement });
            } catch (error) {
              console.error('Pose detection error:', error);
              // Don't crash, just log the error
            }
          }
        },
        width: 640,
        height: 480
      });
      
      cameraRef.current = camera;
      await camera.start();
      
      setExerciseStatus('Ready! Start exercising!');
      console.log('Camera started successfully');
      
    } catch (error) {
      console.error('Camera initialization failed:', error);
      setExerciseStatus(`Camera error: ${error.message}. Please refresh and try again.`);
    }
  };

  const onResults = (results) => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (!canvas || !video) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas size
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        // Draw pose
        drawConnections(ctx, results.poseLandmarks);
        drawLandmarks(ctx, results.poseLandmarks);
        
        // Run detection
        if (isDetectionActive.current) {
          if (currentExercise === 'squats') {
            detectSquats(results);
          } else if (currentExercise === 'jumpingJacks') {
            detectJumpingJacks(results);
          } else {
            setExerciseStatus('Exercise detection not available. Please mark complete manually.');
          }
        }
      } else if (isDetectionActive.current) {
        setExerciseStatus('Position yourself in camera view');
      }
      
    } catch (error) {
      console.error('onResults error:', error);
    }
  };

  const drawConnections = (ctx, landmarks) => {
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [24, 26], [26, 28]
    ];
    
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];
      
      if (startPoint && endPoint && 
          startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x * ctx.canvas.width, startPoint.y * ctx.canvas.height);
        ctx.lineTo(endPoint.x * ctx.canvas.width, endPoint.y * ctx.canvas.height);
        ctx.stroke();
      }
    });
  };

  const drawLandmarks = (ctx, landmarks) => {
    const keyPoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    
    ctx.fillStyle = '#3b82f6';
    
    keyPoints.forEach(index => {
      const landmark = landmarks[index];
      if (landmark && landmark.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * ctx.canvas.width,
          landmark.y * ctx.canvas.height,
          5, 0, 2 * Math.PI
        );
        ctx.fill();
      }
    });
  };

  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const ensureAudioContext = () => {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(console.warn);
    }
  };

  const speakNumber = (number) => {
    try {
      ensureAudioContext();
      
      if (!window.speechSynthesis) return;
      
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(number.toString());
      utterance.lang = currentLanguage === 'mr' ? 'hi-IN' : 'en-US';
      utterance.rate = 1.0;
      utterance.volume = 0.8;
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech failed:', error);
    }
  };

  const speakMessage = (message) => {
    try {
      ensureAudioContext();
      
      if (!window.speechSynthesis) return;
      
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = currentLanguage === 'mr' ? 'hi-IN' : 'en-US';
      utterance.rate = 1.0;
      utterance.volume = 0.8;
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech failed:', error);
    }
  };

  const playBeep = () => {
    ensureAudioContext();
    
    if (!audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Audio failed:', error);
    }
  };

  const triggerHapticFeedback = () => {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  const showSetCompleteOverlay = (message) => {
    setOverlayMessage(message);
    setShowOverlay(true);
    isDetectionActive.current = false;
    
    // Speak set complete message
    const audioMessage = currentLanguage === 'mr' ? 'सेट पूर्ण झाला' : 'Set completed';
    speakMessage(audioMessage);
    
    overlayTimerRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, 2000);
  };

  const detectSquats = (results) => {
    try {
      const landmarks = results.poseLandmarks;
      const leftHip = landmarks[23], leftKnee = landmarks[25], leftAnkle = landmarks[27];
      const rightHip = landmarks[24], rightKnee = landmarks[26], rightAnkle = landmarks[28];
      
      if (![leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle].every(part => part && part.visibility > 0.5)) {
        setExerciseStatus('Show your full body in camera');
        return;
      }
      
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const bothKneesBent = leftKneeAngle < 120 && rightKneeAngle < 120;
      const bothKneesUp = leftKneeAngle > 150 && rightKneeAngle > 150;
      
      if (bothKneesBent && !hasGoneDown.current) {
        hasGoneDown.current = true;
        setExerciseStatus('Going down... Perfect!');
      } else if (bothKneesUp && hasGoneDown.current) {
        hasGoneDown.current = false;
        
        currentExerciseCount.current++;
        setExerciseCount(currentExerciseCount.current);
        
        speakNumber(currentExerciseCount.current);
        triggerHapticFeedback();
        playBeep();
        
        if (currentExerciseCount.current >= repsPerSet) {
          const completeMessage = currentLanguage === 'mr' ? '🎉 सेट पूर्ण! 🎉' : '🎉 SET COMPLETED! 🎉';
          showSetCompleteOverlay(completeMessage);
          setExerciseStatus('SET COMPLETED!');
          
          if (currentSetNumber.current >= totalSets) {
            setTimeout(() => {
              setExerciseStatus('EXERCISE COMPLETED!');
              const exerciseCompleteMessage = currentLanguage === 'mr' ? 'व्यायाम पूर्ण झाला' : 'Exercise completed';
              speakMessage(exerciseCompleteMessage);
              setTimeout(() => {
                cleanup();
                if (onComplete) onComplete(taskIndex);
              }, 3000);
            }, 2000);
          } else {
            setTimeout(() => startRestTimer(), 2000);
          }
        } else {
          setExerciseStatus(`${repsPerSet - currentExerciseCount.current} more squats!`);
        }
      }
    } catch (error) {
      console.error('Squat detection error:', error);
    }
  };

  const detectJumpingJacks = (results) => {
    try {
      const landmarks = results.poseLandmarks;
      const leftShoulder = landmarks[11], rightShoulder = landmarks[12];
      const leftWrist = landmarks[15], rightWrist = landmarks[16];
      const leftAnkle = landmarks[27], rightAnkle = landmarks[28];
      
      if (![leftShoulder, rightShoulder, leftWrist, rightWrist, leftAnkle, rightAnkle].every(part => part && part.visibility > 0.5)) {
        setExerciseStatus('Show your full body in camera');
        return;
      }
      
      const currentArmsUp = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
      const ankleDistance = Math.abs(leftAnkle.x - rightAnkle.x);
      const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
      const currentLegsApart = ankleDistance > shoulderDistance * 1.5;
      
      if (currentArmsUp && currentLegsApart && !hasCompletedJump.current) {
        armsUp.current = true;
        legsApart.current = true;
        setExerciseStatus('Perfect position!');
      } else if (!currentArmsUp && !currentLegsApart && armsUp.current && legsApart.current) {
        hasCompletedJump.current = true;
        armsUp.current = false;
        legsApart.current = false;
        
        currentExerciseCount.current++;
        setExerciseCount(currentExerciseCount.current);
        
        speakNumber(currentExerciseCount.current);
        triggerHapticFeedback();
        playBeep();
        
        if (currentExerciseCount.current >= repsPerSet) {
          const completeMessage = currentLanguage === 'mr' ? '🎉 सेट पूर्ण! 🎉' : '🎉 SET COMPLETED! 🎉';
          showSetCompleteOverlay(completeMessage);
          setExerciseStatus('SET COMPLETED!');
          
          if (currentSetNumber.current >= totalSets) {
            setTimeout(() => {
              setExerciseStatus('EXERCISE COMPLETED!');
              const exerciseCompleteMessage = currentLanguage === 'mr' ? 'व्यायाम पूर्ण झाला' : 'Exercise completed';
              speakMessage(exerciseCompleteMessage);
              setTimeout(() => {
                cleanup();
                if (onComplete) onComplete(taskIndex);
              }, 3000);
            }, 2000);
          } else {
            setTimeout(() => startRestTimer(), 2000);
          }
        } else {
          setExerciseStatus(`${repsPerSet - currentExerciseCount.current} more jumping jacks!`);
        }
        
        setTimeout(() => { 
          hasCompletedJump.current = false; 
        }, 500);
      }
    } catch (error) {
      console.error('Jumping jacks detection error:', error);
    }
  };

  const playWhistle = () => {
    ensureAudioContext();
    
    if (!audioContext) return;
    
    try {
      // Create whistle sound using higher frequency oscillator
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Whistle sound - quick high pitch burst
      oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(2500, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Whistle sound failed:', error);
    }
  };

  const startRestTimer = () => {
    ensureAudioContext();
    
    setIsResting(true);
    let restTimeLeft = restTimeFromExercise;
    setRestTime(restTimeLeft);
    setExerciseStatus(`Rest for ${restTimeFromExercise} seconds`);
    
    // Announce rest period
    const restMessage = currentLanguage === 'mr' ? 'विश्रांती घ्या' : 'Take rest';
    speakMessage(restMessage);
    
    restTimerRef.current = setInterval(() => {
      restTimeLeft--;
      setRestTime(restTimeLeft);
      
      // Countdown audio for last 5 seconds
      if (restTimeLeft <= 5 && restTimeLeft > 0) {
        speakNumber(restTimeLeft);
      }
      
      if (restTimeLeft <= 0) {
        clearInterval(restTimerRef.current);
        setIsResting(false);
        
        // Play whistle sound when rest ends
        playWhistle();
        
        if (currentSetNumber.current < totalSets) {
          currentExerciseCount.current = 0;
          currentSetNumber.current++;
          setExerciseCount(0);
          setCurrentSet(currentSetNumber.current);
          
          hasGoneDown.current = false;
          armsUp.current = false;
          legsApart.current = false;
          hasCompletedJump.current = false;
          
          isDetectionActive.current = true;
          setExerciseStatus(`Set ${currentSetNumber.current} - Ready!`);
          
          // Announce next set
          const nextSetMessage = currentLanguage === 'mr' ? `सेट ${currentSetNumber.current} तयार` : `Set ${currentSetNumber.current} ready`;
          speakMessage(nextSetMessage);
        }
      }
    }, 1000);
  };

  const cleanup = () => {
    console.log('Cleaning up camera...');
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
      
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
      
      if (poseRef.current) {
        try {
          poseRef.current.close();
        } catch (error) {
          console.warn('Error closing pose:', error);
        }
        poseRef.current = null;
      }
      
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (error) {
          console.warn('Error stopping camera:', error);
        }
        cameraRef.current = null;
      }
      
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  const handleClose = () => {
    const message = currentLanguage === 'mr' 
      ? 'बंद केल्याने तुमच्या दिवसभराचा व्यायाम प्रगती रीसेट होईल. तुम्हाला पुढे जायचे आहे का?'
      : 'Closing will restart your full day\'s exercise progress. Do you want to continue?';
    
    if (window.confirm(message)) {
      // Force page reload to ensure camera stops completely
      cleanup();
      window.location.reload();
    }
    // If user clicks "No", nothing happens - they stay in the camera
  };

  if (!isVisible) return null;

  const getExerciseTitle = () => {
    if (currentExercise === 'squats') {
      return currentLanguage === 'mr' ? 'स्क्वॅट काउंटर' : 'Squat Counter';
    } else if (currentExercise === 'jumpingJacks') {
      return currentLanguage === 'mr' ? 'जंपिंग जॅक काउंटर' : 'Jumping Jacks Counter';
    } else {
      return 'Exercise Counter';
    }
  };

  return (
    <div className="camera-section">
      <div className="camera-container">
        <button className="camera-close" onClick={handleClose}>✕</button>
        
        <h2>{getExerciseTitle()}</h2>
        
        <div className="set-info">Set {currentSet} of {totalSets}</div>
        <div className="exercise-counter">{exerciseCount}</div>
        <div className="target-info">Target: {repsPerSet}</div>
        <div className="exercise-status">{exerciseStatus}</div>
        {isResting && <div className="rest-timer">Rest: {restTime}s</div>}
        
        <div className="video-container" style={{ position: 'relative' }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: '640px', borderRadius: '8px' }}></video>
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', borderRadius: '8px' }}></canvas>
          
          {showOverlay && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold',
              textAlign: 'center',
              borderRadius: '8px'
            }}>
              {overlayMessage}
            </div>
          )}
        </div>

        {/* Exercise Demo Videos */}
        <div className="exercise-demo" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>
            {currentExercise === 'squats' 
              ? (currentLanguage === 'mr' ? 'स्क्वॅट कसे करावे' : 'How to do Squats') 
              : currentExercise === 'jumpingJacks'
              ? (currentLanguage === 'mr' ? 'जंपिंग जॅक्स कसे करावे' : 'How to do Jumping Jacks')
              : (currentLanguage === 'mr' ? 'व्यायाम कसे करावे' : 'How to do this Exercise')
            }
          </h3>
          
          {currentExercise === 'squats' && (
            <iframe
              width="100%"
              height="200"
              src="https://www.youtube.com/embed/-5LhNSMBrEs?enablejsapi=1&fs=1&modestbranding=1"
              title="How to do Squats"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              style={{ 
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                touchAction: 'manipulation'
              }}
            ></iframe>
          )}
          
          {currentExercise === 'jumpingJacks' && (
            <iframe
              width="100%"
              height="200"
              src="https://www.youtube.com/embed/uLVt6u15L98?enablejsapi=1&fs=1&modestbranding=1"
              title="How to do Jumping Jacks"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              style={{ 
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                touchAction: 'manipulation'
              }}
            ></iframe>
          )}
          
          {(currentExercise !== 'squats' && currentExercise !== 'jumpingJacks') && (
            <div style={{
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#666'
            }}>
              <p>Exercise demonstration video will be added soon</p>
              <p>Follow the rep and set counts shown above</p>
            </div>
          )}
        </div>

        <button 
          style={{ 
            marginTop: '20px',
            background: '#25d366',
            color: 'white',
            border: 'none',
            padding: '15px 25px',
            borderRadius: '25px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
          onClick={() => {
            const message = currentLanguage === 'en' 
              ? 'Hi, I need help with exercise camera detection in Spocademy'
              : 'नमस्कार, मला Spocademy मध्ये व्यायाम कॅमेरा डिटेक्शनसाठी मदत हवी';
            
            const whatsappUrl = `https://wa.me/919359246193?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
          }}
        >
          Need Help? Contact Support
        </button>
      </div>
    </div>
  );
};

export default EnhancedCamera;