import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const SMOOTHING = 0.8
const STEP_THRESHOLD = 1.1
const MIN_STEP_INTERVAL_MS = 400
const GRAVITY = 9.81
const GOAL_STEPS = 10000
const AVATAR_NAME = 'Richard'

type PermissionState = 'idle' | 'pending' | 'granted' | 'denied'
type AvatarState = 'fat' | 'normal' | 'fit'
type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [steps, setSteps] = useState(1000)
  const [isTracking, setIsTracking] = useState(false)
  const [permissionState, setPermissionState] = useState<PermissionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  const lastStepAtRef = useRef(0)
  const filteredMagnitudeRef = useRef(GRAVITY)
  const hasAutoStartedRef = useRef(false)
  const permissionRequestedRef = useRef(false)

  // Compute motion availability directly during render
  const motionAvailable = typeof window !== 'undefined' && 'DeviceMotionEvent' in window

  // Compute error message based on motion availability
  const apiError = !motionAvailable ? 'Device Motion API is not available in this browser.' : null

  const avatarState = useMemo(() => {
    if (steps < GOAL_STEPS) return 'fat' as AvatarState
    if (steps < GOAL_STEPS * 2) return 'normal' as AvatarState
    return 'fit' as AvatarState
  }, [steps])

  const avatarImage = useMemo(() => {
    return `/${avatarState}.png`
  }, [avatarState])

  const avatarStateLabel = useMemo(() => {
    return avatarState
  }, [avatarState])

  const progressPercentage = useMemo(() => {
    return Math.min((steps / GOAL_STEPS) * 100, 200)
  }, [steps])

  const formattedSteps = useMemo(() => {
    return steps.toLocaleString()
  }, [steps])

  const formattedGoal = useMemo(() => {
    return GOAL_STEPS.toLocaleString()
  }, [])

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
      setSteps((current) => current + 1000)
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

  // Request permission immediately on mount (for browsers that allow it)
  useEffect(() => {
    if (!motionAvailable || permissionRequestedRef.current) {
      return
    }

    const deviceMotionWithPermission = window
      .DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }

    // If requestPermission exists, try to request it immediately
    if (
      deviceMotionWithPermission &&
      typeof deviceMotionWithPermission.requestPermission === 'function'
    ) {
      permissionRequestedRef.current = true
      // Try to request permission immediately (works on some browsers)
      deviceMotionWithPermission
        .requestPermission()
        .then((status) => {
          if (status === 'granted') {
            setPermissionState('granted')
            // Auto-start tracking if permission was granted
            if (!hasAutoStartedRef.current && !isTracking) {
              hasAutoStartedRef.current = true
              filteredMagnitudeRef.current = GRAVITY
              lastStepAtRef.current = 0
              setSteps(0)
              setIsTracking(true)
            }
          } else {
            setPermissionState('denied')
            setError('Motion access was not granted.')
          }
        })
        .catch(() => {
          // Permission request failed (likely needs user gesture on iOS)
          // Will retry on first user interaction
          permissionRequestedRef.current = false
        })
    } else {
      // No permission API needed, auto-start tracking
      permissionRequestedRef.current = true
      setPermissionState('granted')
      if (!hasAutoStartedRef.current && !isTracking) {
        hasAutoStartedRef.current = true
        filteredMagnitudeRef.current = GRAVITY
        lastStepAtRef.current = 0
        setSteps(0)
        setIsTracking(true)
      }
    }
  }, [motionAvailable, isTracking])

  // Request permission on first user interaction (for iOS which requires user gesture)
  useEffect(() => {
    if (!motionAvailable || permissionState !== 'idle') {
      return
    }

    const handleFirstInteraction = async () => {
      if (permissionRequestedRef.current) {
        return
      }

      const deviceMotionWithPermission = window
        .DeviceMotionEvent as typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<'granted' | 'denied'>
        }

      if (
        deviceMotionWithPermission &&
        typeof deviceMotionWithPermission.requestPermission === 'function'
      ) {
        permissionRequestedRef.current = true
        try {
          setPermissionState('pending')
          const status = await deviceMotionWithPermission.requestPermission()
          if (status === 'granted') {
            setPermissionState('granted')
            // Auto-start tracking if permission was granted
            if (!hasAutoStartedRef.current && !isTracking) {
              hasAutoStartedRef.current = true
              filteredMagnitudeRef.current = GRAVITY
              lastStepAtRef.current = 0
              setSteps(0)
              setIsTracking(true)
            }
          } else {
            setPermissionState('denied')
            setError('Motion access was not granted.')
          }
        } catch {
          setPermissionState('denied')
          setError('Motion permission request failed.')
        }
      }

      // Remove listeners after first interaction
      window.removeEventListener('touchstart', handleFirstInteraction, { capture: true })
      window.removeEventListener('click', handleFirstInteraction, { capture: true })
    }

    // Listen for first user interaction (touch or click)
    window.addEventListener('touchstart', handleFirstInteraction, { capture: true, once: true })
    window.addEventListener('click', handleFirstInteraction, { capture: true, once: true })

    return () => {
      window.removeEventListener('touchstart', handleFirstInteraction, { capture: true })
      window.removeEventListener('click', handleFirstInteraction, { capture: true })
    }
  }, [motionAvailable, permissionState, isTracking])

  // Manual permission request handler
  const handleRequestPermission = useCallback(async () => {
    if (!motionAvailable) {
      setError('Device Motion API is not supported in this context.')
      return
    }

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
        setError(null)
        const status = await deviceMotionWithPermission.requestPermission()
        if (status === 'granted') {
          setPermissionState('granted')
          // Auto-start tracking if permission was granted
          if (!hasAutoStartedRef.current && !isTracking) {
            hasAutoStartedRef.current = true
            filteredMagnitudeRef.current = GRAVITY
            lastStepAtRef.current = 0
            setSteps(0)
            setIsTracking(true)
          }
        } else {
          setPermissionState('denied')
          setError('Motion access was not granted.')
        }
      } catch {
        setPermissionState('denied')
        setError('Motion permission request failed.')
      }
    } else {
      // No permission API needed, auto-start tracking
      setPermissionState('granted')
      if (!hasAutoStartedRef.current && !isTracking) {
        hasAutoStartedRef.current = true
        filteredMagnitudeRef.current = GRAVITY
        lastStepAtRef.current = 0
        setSteps(0)
        setIsTracking(true)
      }
    }
  }, [motionAvailable, isTracking])

  // Chat functionality
  const getChatApiUrl = useCallback(() => {
    const envUrl = import.meta.env.VITE_CHAT_API_URL
    if (envUrl && typeof envUrl === 'string') {
      return envUrl
    }
    // Default to /api which will be proxied to the backend
    // Works with Vite dev server proxy and Cloudflare tunnel
    return '/api'
  }, [])

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
    }

    const updatedMessages = [...chatMessages, userMessage]
    setChatMessages(updatedMessages)
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetch(`${getChatApiUrl()}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stepCount: steps,
          goal: GOAL_STEPS,
          avatarState: avatarState,
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`)
      }

      const data = await response.json()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Sorry, I could not generate a response.',
      }

      setChatMessages([...updatedMessages, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      console.error('[App] Chat error:', err)
      setError(errorMessage)
      // Remove the user message on error - revert to previous state
      setChatMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsChatLoading(false)
    }
  }, [chatInput, chatMessages, isChatLoading, getChatApiUrl, steps, avatarState])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isChatLoading])

  // Auto-focus input when chat opens
  useEffect(() => {
    if (showChat) {
      // Small delay to ensure the panel is rendered
      setTimeout(() => {
        chatInputRef.current?.focus()
      }, 100)
    }
  }, [showChat])

  const handleChatToggle = useCallback(() => {
    setShowChat((prev) => !prev)
  }, [])

  const displayError = error || apiError

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

        {/* Motion permission button - show when permission not granted */}
        {permissionState !== 'granted' && motionAvailable && (
          <button
            className="permission-button"
            onClick={handleRequestPermission}
            disabled={permissionState === 'pending'}
            aria-label="Request motion permission"
          >
            {permissionState === 'pending' ? 'Requesting...' : 'Enable Step Tracking'}
          </button>
        )}

        {/* Chat toggle button - bottom right */}
        <button 
          className={`talk-button ${showChat ? 'active' : ''}`}
          onClick={handleChatToggle}
          aria-label={showChat ? 'Close chat' : 'Open chat'}
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

        {/* Chat panel */}
        {showChat && (
          <div className="chat-panel">
            <div className="chat-header">
              <h3>Chat</h3>
              <button 
                className="chat-close-button"
                onClick={handleChatToggle}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon">💬</div>
                  <p className="chat-empty-title">Start a conversation!</p>
                  <p className="chat-empty-text">Ask about your fitness progress, get health tips, or ask for motivation to reach your step goal.</p>
                  <div className="chat-suggestions">
                    <button
                      className="chat-suggestion-button"
                      onClick={() => {
                        setChatInput("How can I reach my step goal today?")
                        chatInputRef.current?.focus()
                      }}
                    >
                      💪 Reach my goal
                    </button>
                    <button
                      className="chat-suggestion-button"
                      onClick={() => {
                        setChatInput("Give me some fitness tips")
                        chatInputRef.current?.focus()
                      }}
                    >
                      🏃 Fitness tips
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="chat-message-content">
                        {msg.content.split('\n').map((line, lineIdx) => (
                          <span key={lineIdx}>
                            {line}
                            {lineIdx < msg.content.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="chat-message assistant">
                      <div className="chat-message-content chat-typing">
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                      </div>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </>
              )}
            </div>
            <div className="chat-input-container">
              <input
                ref={chatInputRef}
                type="text"
                className="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Ask about your fitness progress..."
                disabled={isChatLoading}
              />
              <button
                className="chat-send-button"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isChatLoading}
                aria-label="Send message"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
