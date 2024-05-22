import { onCleanup, onMount, Show, useContext } from 'solid-js'
import { getDatabase, onValue, ref } from 'firebase/database'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { AppContext, createAppStore } from './store'
import app from 'shared/firebase'
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from '@firebase/auth'

const Login = () => {
  const [store, { setLoading }] = useContext(AppContext)
  const provider = new GoogleAuthProvider()
  const loginWithGoogle = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    return signInWithPopup(getAuth(store.app), provider)
  }
  return (
    <form onSubmit={loginWithGoogle}>
      <button
        type="submit"
        disabled={store.loading}
        class="button button-primary w-full my-12"
      >
        Sign in with Google
      </button>
    </form>
  )
}
const functions = getFunctions(app, 'europe-west1')
const generateObsidianToken = httpsCallable(functions, 'generateObsidianToken')
const wipe = httpsCallable(functions, 'wipe')

const Authed = () => {
  const [store, { setCurrentUser, setObsidianToken, setLoading }] =
    useContext(AppContext)

  const handleGenerateClick = async () => {
    setLoading(true)
    try {
      const { data } = await generateObsidianToken()
      typeof data === 'string' && setObsidianToken(data)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoutClick = async (auth: Auth) => {
    try {
      setLoading(true)
      await signOut(auth)
      setCurrentUser(undefined)
    } finally {
      setLoading(false)
    }
  }

  const handleClearClick = async () => {
    try {
      setLoading(true)
      // clear everything
      await wipe({ id: -1 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section>
        <div class="flex flex-col md:flex-row md:justify-between items-center bg-neutral-shade p-4 rounded-3xl my-8">
          <p>
            You're signed in as{' '}
            <strong>{store.currentUser?.displayName}</strong> (
            {store.currentUser?.email})
          </p>
          <button
            onClick={() => handleLogoutClick(getAuth(store.app))}
            disabled={store.loading}
            class="md:w-auto button"
          >
            Logout
          </button>
        </div>

        <div class="flex flex-col md:flex-row md:justify-left">
          {!store.obsidianToken && (
            <button
              onClick={handleGenerateClick}
              disabled={store.loading}
              class="md:w-auto md:mr-5 button button-primary"
            >
              Generate Obsidian Login Token
            </button>
          )}
        </div>
        {store.obsidianToken && (
          <>
            <h3 class="mt-8">Obsidian login token</h3>
            <p>
              Copy token and paste into the{' '}
              <strong>AudioPen-Obsidian Sync</strong> plugin settings:
            </p>
            <input
              type="text"
              class="form-input w-full"
              readOnly={true}
              value={store.obsidianToken}
            />
          </>
        )}
      </section>
      {store.key && (
        <>
          <h3 class="mt-8"> Webhook URL </h3>
          <div class="mb-4">
            <ul>
              <li>Use this URL as your AudioPen webhook.</li>
              <li>
                Step by step instructions are in the{' '}
                <a
                  href="https://github.com/jonashaefele/audiopen-obsidian?tab=readme-ov-file#4-how-to-add-the-webhook-to-audiopen"
                  target="_blank"
                  class="link"
                >
                  README on GitHub
                </a>
              </li>
            </ul>
          </div>
          <input
            type="text"
            readOnly={true}
            class="form-input"
            value={`https://europe-west1-audiopen-obsidian.cloudfunctions.net/webhook/${store.key}`}
          />
        </>
      )}
      {store.buffer && (
        <>
          <button
            onClick={() => handleClearClick()}
            disabled={store.loading}
            title="Click if plugin is erroring"
            class="md:w-auto md:mr-5 button"
          >
            Clear Buffer ⚠️
          </button>
          {store.buffer.map((v) => (
            <div>{JSON.stringify(v.val)}</div>
          ))}
        </>
      )}
    </>
  )
}

function App() {
  const store = createAppStore()
  const [state, { setApp, setLoading, setKey, setCurrentUser }] = store

  setApp(app)
  const auth = getAuth(state.app)

  let keyUnsubscribe = () => {}
  const authUnsubscribe = auth.onAuthStateChanged((user: User | null) => {
    keyUnsubscribe()
    setCurrentUser(user || undefined)
    if (user) {
      setLoading(true)
      const db = getDatabase(state.app)
      keyUnsubscribe = onValue(ref(db, `users/${user.uid}/key`), (value) => {
        const val = value.val()
        setKey(val)
        if (val) {
          setLoading(false)
        }
      })
    } else {
      setLoading(false)
    }
  })

  onCleanup(() => {
    authUnsubscribe()
    keyUnsubscribe()
  })

  return (
    <>
      <main class="container bg-white rounded-3xl p-12 my-8">
        <section>
          <hgroup>
            <h1> AudioPen-Obsidian Webhook </h1>
            <h2>
              Connect{' '}
              <a
                href="https://audiopen.ai/?aff=x0g97"
                target="_blank"
                class="text-[rgb(255,92,10)] underline"
              >
                AudioPen
              </a>{' '}
              to{' '}
              <a
                href="https://obsidian.md/"
                target="_blank"
                class="text-[rgb(124,58,237)] underline"
              >
                Obsidian
              </a>{' '}
              and create at the speed of thought.
            </h2>
          </hgroup>
          <Show when={state.loading}>
            <section>
              <div>
                <progress class="progress is-primary" max="100"></progress>
              </div>
            </section>
          </Show>
          <AppContext.Provider value={store}>
            {state.currentUser ? <Authed /> : <Login />}
          </AppContext.Provider>

          <article class="mt-8">
            <h3 class="mt-8">Support this project</h3>
            <p>
              This service and plugin is a passion project and an experiement in
              how we can use technology in a more humane and embodied way. I
              offer it for free as long as I can. Any help in covering server
              costs and continued development is appreciated, but not expected.
            </p>
            <div class="my-4 flex flex-row items-center">
              <span>If this tool is helpful to you, you can</span>
              <a
                href="https://ko-fi.com/jonashaefele"
                target="_blank"
                class="ml-2"
              >
                <img
                  class="h-9 border-0"
                  src="https://cdn.ko-fi.com/cdn/kofi1.png?v=3"
                  alt="Buy Me a Coffee at ko-fi.com"
                />
              </a>
              <span class="inline-block mx-4">or sponsor me on GitHub</span>
              <iframe
                src="https://github.com/sponsors/jonashaefele/button"
                title="Sponsor jonashaefele"
                height="32"
                width="114"
                style="border: 0; border-radius: 6px;"
              ></iframe>
            </div>
            <p>
              And while you're at it, you might be interested in some of the
              other things I think about and create. You can find my work{' '}
              <a class="link" href="https://slow.works">
                slow.works
              </a>{' '}
              and read about my thoughts on{' '}
              <a class="link" href="https://slowworks.substack.com/">
                Substack
              </a>
            </p>
          </article>
        </section>
      </main>
    </>
  )
}

export default App
