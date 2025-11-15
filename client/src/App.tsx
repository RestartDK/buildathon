import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const SMOOTHING = 0.8
const STEP_THRESHOLD = 1.1
const MIN_STEP_INTERVAL_MS = 400
const GRAVITY = 9.81
const GOAL_STEPS = 100
const AVATAR_NAME = 'Richard'

type PermissionState = 'idle' | 'pending' | 'granted' | 'denied'
type AvatarState = 'fat' | 'normal' | 'fit'

function App() {
  const [steps, setSteps] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [permissionState, setPermissionState] = useState<PermissionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const lastStepAtRef = useRef(0)
  const filteredMagnitudeRef = useRef(GRAVITY)
  const hasAutoStartedRef = useRef(false)

  // Compute motion availability directly during render
  const motionAvailable = typeof window !== 'undefined' && 'DeviceMotionEvent' in window

  // Compute error message based on motion availability
  const apiError = !motionAvailable ? 'Device Motion API is not available in this browser.' : null

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acceleration =
      event.accelerationIncludingGravity ?? event.acceleration

    if (!acceleration) {
      return
    }

    const x = acceleration.x ?? 0
    const y = acceleration.y ?? 0
    const z = acceleration.z ?? 0
    const magnitude = Math.sqrt(x * x + y * y + z * z)

    const filtered =
      SMOOTHING * filteredMagnitudeRef.current +
      (1 - SMOOTHING) * magnitude

    filteredMagnitudeRef.current = filtered

    const delta = Math.abs(magnitude - filtered)
    const now = Date.now()

    if (delta > STEP_THRESHOLD && now - lastStepAtRef.current > MIN_STEP_INTERVAL_MS) {
      lastStepAtRef.current = now
      setSteps((current) => current + 1)
    }
  }, [])

  useEffect(() => {
    if (!isTracking) {
      return
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [handleMotion, isTracking])

  const startTracking = useCallback(async () => {
    if (!motionAvailable) {
      setError('Device Motion API is not supported in this context.')
      return
    }

    setError(null)

    const deviceMotionWithPermission = window
      .DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }

    if (
      deviceMotionWithPermission &&
      typeof deviceMotionWithPermission.requestPermission === 'function'
    ) {
      try {
        setPermissionState('pending')
        const status = await deviceMotionWithPermission.requestPermission()
        if (status !== 'granted') {
          setPermissionState('denied')
          setError('Motion access was not granted.')
          return
        }
        setPermissionState('granted')
      } catch {
        setPermissionState('denied')
        setError('Motion permission request failed.')
        return
      }
    } else {
      setPermissionState('granted')
    }

    filteredMagnitudeRef.current = GRAVITY
    lastStepAtRef.current = 0
    setSteps(0)
    setIsTracking(true)
  }, [motionAvailable])

  // Auto-start tracking on mount (only once)
  useEffect(() => {
    if (!hasAutoStartedRef.current && motionAvailable && permissionState === 'idle' && !isTracking) {
      hasAutoStartedRef.current = true
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        startTracking()
      }, 0)
    }
  }, [motionAvailable, permissionState, isTracking, startTracking])

  const displayError = error || apiError

  // Calculate avatar state based on steps
  const avatarState = useMemo<AvatarState>(() => {
    if (steps < GOAL_STEPS) return 'fat'
    if (steps < GOAL_STEPS * 2) return 'normal'
    return 'fit'
  }, [steps])

  // Get avatar image path
  const avatarImage = useMemo(() => {
    return `/${avatarState}.png`
  }, [avatarState])

  // Get avatar state label
  const avatarStateLabel = useMemo(() => {
    return avatarState
  }, [avatarState])

  // Calculate progress percentage (capped at 200%)
  const progressPercentage = useMemo(() => {
    return Math.min((steps / GOAL_STEPS) * 100, 200)
  }, [steps])

  // Format steps with commas
  const formattedSteps = useMemo(() => {
    return steps.toLocaleString()
  }, [steps])

  const formattedGoal = useMemo(() => {
    return GOAL_STEPS.toLocaleString()
  }, [])

  return (
    <main className="app-shell">
      <section className="panel">
        {/* Top bar with step count / goal */}
        <div className="top-bar">
          <div className="step-count">
            <span className="step-number">{formattedSteps}</span>
            <span className="step-separator"> / </span>
            <span className="goal-number">{formattedGoal}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-container">
          <div className="progress-bracket">[</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="progress-bracket">]</div>
        </div>

        {/* Avatar */}
        <div className="avatar-container">
          <img 
            src={avatarImage} 
            alt={`${AVATAR_NAME} avatar`}
            className="avatar-image"
          />
        </div>

        {/* Avatar status text */}
        <div className="avatar-status">
          <span className="avatar-name">{AVATAR_NAME}</span>
          <span className="avatar-status-text"> is </span>
          <span className="avatar-state">{avatarStateLabel}</span>
        </div>

        {displayError && <p className="alert">{displayError}</p>}

        {/* Talk toggle button - bottom right */}
        <button 
          className={`talk-button ${isSpeaking ? 'active' : ''}`}
          onClick={() => setIsSpeaking(!isSpeaking)}
          aria-label="Toggle speaking to avatar"
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </section>
    </main>
  )
}

export default App
