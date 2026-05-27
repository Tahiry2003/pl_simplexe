import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section
        id="center"
        className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center"
      >
        <div className="relative flex items-center justify-center">
          <img
            src={heroImg}
            className="w-[170px]"
            alt=""
          />

          <img
            src={reactLogo}
            className="absolute left-0 top-0 w-16 animate-spin"
            alt="React logo"
          />

          <img
            src={viteLogo}
            className="absolute bottom-0 right-0 w-16"
            alt="Vite logo"
          />
        </div>

        <div>
          <h1 className="mb-4 text-5xl font-bold">
            Get started
          </h1>

          <p className="text-lg text-gray-600">
            Edit <code className="rounded bg-gray-100 px-2 py-1">src/App.jsx</code> and save to test{' '}
            <code className="rounded bg-gray-100 px-2 py-1">HMR</code>
          </p>
        </div>

        <button
          type="button"
          className="rounded-xl bg-black px-6 py-3 text-lg font-semibold text-white transition hover:scale-105"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="h-px w-full bg-gray-200"></div>

      <section
        id="next-steps"
        className="grid gap-6 px-6 py-16 md:grid-cols-2"
      >
        <div
          id="docs"
          className="rounded-2xl border border-gray-200 p-8 shadow-sm"
        >
          <svg
            className="mb-4 h-10 w-10"
            role="presentation"
            aria-hidden="true"
          >
            <use href="/icons.svg#documentation-icon"></use>
          </svg>

          <h2 className="mb-2 text-2xl font-bold">
            Documentation
          </h2>

          <p className="mb-6 text-gray-600">
            Your questions, answered
          </p>

          <ul className="space-y-4">
            <li>
              <a
                href="https://vite.dev/"
                target="_blank"
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <img
                  className="w-8"
                  src={viteLogo}
                  alt=""
                />

                Explore Vite
              </a>
            </li>

            <li>
              <a
                href="https://react.dev/"
                target="_blank"
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <img
                  className="w-8"
                  src={reactLogo}
                  alt=""
                />

                Learn more
              </a>
            </li>
          </ul>
        </div>

        <div
          id="social"
          className="rounded-2xl border border-gray-200 p-8 shadow-sm"
        >
          <svg
            className="mb-4 h-10 w-10"
            role="presentation"
            aria-hidden="true"
          >
            <use href="/icons.svg#social-icon"></use>
          </svg>

          <h2 className="mb-2 text-2xl font-bold">
            Connect with us
          </h2>

          <p className="mb-6 text-gray-600">
            Join the Vite community
          </p>

          <ul className="space-y-4">
            <li>
              <a
                href="https://github.com/vitejs/vite"
                target="_blank"
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <svg
                  className="h-6 w-6"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>

                GitHub
              </a>
            </li>

            <li>
              <a
                href="https://chat.vite.dev/"
                target="_blank"
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <svg
                  className="h-6 w-6"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>

                Discord
              </a>
            </li>

            <li>
              <a
                href="https://x.com/vite_js"
                target="_blank"
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <svg
                  className="h-6 w-6"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>

                X.com
              </a>
            </li>

            <li>
              <a
                href="https://bsky.app/profile/vite.dev"
                target="_blank"
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <svg
                  className="h-6 w-6"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>

                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="h-px w-full bg-gray-200"></div>

      <section id="spacer" className="h-32"></section>
    </>
  )
}

export default App