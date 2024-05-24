import { onCleanup, onMount, Show, useContext } from 'solid-js'
import { getDatabase, onValue, ref } from 'firebase/database'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { AppContext, createAppStore } from './store'
import app from '@shared/firebase'
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from '@firebase/auth'
import { BufferItem } from '@shared/types'

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
  const [store, { setCurrentUser, setObsidianToken, setLoading, setBuffer }] =
    useContext(AppContext)

  onMount(() => {
    const db = getDatabase(store.app)
    const buffer = ref(db, `/buffer/${store.currentUser?.uid}`)
    const unsubscribe = onValue(buffer, (snapshot) => {
      const bufferData = snapshot.val()
      if (bufferData) {
        const bufferItems: BufferItem[] = Object.values(bufferData)
        setBuffer(bufferItems)
      } else {
        setBuffer([])
      }
    })

    onCleanup(() => unsubscribe())
  })

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

  const handleClearClick = async (id: string) => {
    try {
      setLoading(true)
      // clear everything
      await wipe({ id })
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = async (all: string) => {
    if (all === 'all') {
      try {
        setLoading(true)
        // clear everything
        store.buffer?.map((v) => {
          handleClearClick(v.id)
        })
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <>
      <section>
        <div class="flex flex-col md:flex-row md:justify-between items-center bg-neutral-shade px-8 py-4 rounded-3xl my-8 gap-4">
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

        <div class="flex flex-col bg-neutral p-4 rounded-3xl my-8">
          <div class="flex flex-col md:flex-row md:justify-between md:items-center px-4 pb-4 rounded-3xl gap-4">
            <div>
              <h3>Obsidian login token</h3>
              {!store.obsidianToken && (
                <p>First, let's get a login token from Obsidian</p>
              )}
            </div>
            {!store.obsidianToken && (
              <button
                onClick={handleGenerateClick}
                disabled={store.loading}
                class="md:w-auto button button-primary"
              >
                Generate Obsidian Login Token
              </button>
            )}
          </div>
          {store.obsidianToken && (
            <div class="px-4 pb-4">
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
            </div>
          )}
        </div>
      </section>
      {store.key && (
        <div class="flex flex-col bg-neutral p-8 pt-4 rounded-3xl my-8 gap-4">
          <h3> Webhook URL </h3>
          <div>
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
        </div>
      )}
      {store.buffer && store.buffer.length > 0 && (
        <div class="flex flex-col bg-neutral p-4 rounded-3xl my-8">
          <div class="flex flex-col md:flex-row md:justify-between items-center p-4 pt-0 rounded-3xl">
            <div>
              <h3>You have notes waiting in your buffer</h3>
              <p>
                If things are not syncing, try clearing the buffer. This won't
                delete anything from AudioPen.
              </p>
            </div>
            <button
              onClick={() => handleClearAll('all')}
              disabled={store.loading}
              title="Click if plugin is erroring"
              class="md:w-auto button flex-nowrap text-nowrap"
            >
              Clear All ⚠️
            </button>
          </div>

          {store.buffer.map((v) => (
            <div class="bg-neutral-hint shadow-sm my-4 p-4 pl-6 rounded-xl flex flex-col md:flex-row md:justify-between items-center">
              <div>
                <h3>{v.data.title}</h3>
                <p>{v.data.body.substring(0, 300)} ...</p>
              </div>
              <button
                onClick={() => handleClearClick(v.data.id)}
                disabled={store.loading}
                title="Click if plugin is erroring"
                class="md:w-auto md:mr-5 button button-sm button-secondary"
              >
                Clear
              </button>
            </div>
          ))}
        </div>
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
      <main class="container bg-white shadow rounded-3xl p-4 md:p-12 my-8">
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

          <article class="mt-8 p-8">
            <h3>Support this project</h3>
            <p>
              This service and plugin is a passion project and an experiement in
              how we can use technology in a more humane and embodied way. I
              offer it for free as long as I can. Any help in covering server
              costs and continued development is appreciated, but not expected.
            </p>
            <div class="my-4 flex flex-col md:flex-row items-center gap-4">
              <span>If this tool is helpful to you, you can</span>
              <a href="https://ko-fi.com/jonashaefele" target="_blank">
                <img
                  class="h-9 border-0"
                  src="https://cdn.ko-fi.com/cdn/kofi1.png?v=3"
                  alt="Buy Me a Coffee at ko-fi.com"
                />
              </a>
              <span class="inline-block">or sponsor me on GitHub</span>
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
      <footer class="container p-4 md:p-8 my-8 text-center text-primary flex flex-col items-center gap-4">
        <p>
          Made with 💙 in London by{' '}
          <a href="https://www.instagram.com/jonashaefele/" target="_blank">
            Jonas Haefele
          </a>
        </p>
        <a href="https://slow.works">
          <img src="/favicon.svg" width={40} height={40} />
        </a>
      </footer>
    </>
  )
}

export default App
