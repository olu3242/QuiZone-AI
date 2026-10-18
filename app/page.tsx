import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  Sparkles,
  Globe2,
  Check,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { zones, steps, faqs } from "@/lib/content";
export default function Landing() {
  return (
    <>
      <header className="public-nav wrap">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#zones">Explore the Zones</a>
          <a href="#how">How it works</a>
          <a href="#safety">Made for families</a>
        </nav>
        <div className="nav-actions">
          <Link href="/login">Log in</Link>
          <Link className="btn small" href="/signup">
            Start your adventure <ArrowRight size={16} />
          </Link>
        </div>
      </header>
      <main id="main">
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="pill">
              <span className="live-dot" /> A little less scrolling. A lot more
              together.
            </div>
            <h1>
              Big ideas start
              <br />
              with <span className="underline-yellow">family time.</span>
            </h1>
            <p>
              Turn “what should we do tonight?” into an adventure. Play, solve,
              and discover a world of possibilities. Together.
            </p>
            <div className="hero-actions">
              <Link href="/signup" className="btn">
                Let’s play together <ArrowRight size={19} />
              </Link>
              <a href="#zones" className="btn secondary">
                Find your Zone
              </a>
            </div>
            <div className="hero-notes">
              <span>
                <Check size={16} /> One shared screen
              </span>
              <span>
                <Check size={16} /> Grown-up guided
              </span>
              <span>
                <Check size={16} /> Built for curious minds
              </span>
            </div>
          </div>
          <div
            className="adventure-art"
            aria-label="Illustrated family game-night adventure"
          >
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <span className="art-star star-one">✦</span>
            <span className="art-star star-two">✦</span>
            <div className="floating-label label-top">
              <Sparkles size={18} /> Tonight’s forecast: bright ideas
            </div>
            <div className="planet">
              <div className="planet-land land-one" />
              <div className="planet-land land-two" />
              <div className="planet-land land-three" />
              <div className="planet-face">
                <span>•</span>
                <span>•</span>
                <i />
              </div>
            </div>
            <div className="art-card card-quick">
              <span>⚡</span>
              <div>
                <small>QUICKZONE</small>
                <strong>Ready, set, wonder.</strong>
              </div>
            </div>
            <div className="art-card card-solve">
              <span>◈</span>
              <div>
                <small>SOLVEZONE</small>
                <strong>What if we tried…</strong>
              </div>
            </div>
            <div className="avatar-stack">
              <span>🦊</span>
              <span>🐼</span>
              <span>🦉</span>
              <b>
                Everyone has
                <br />a part to play.
              </b>
            </div>
            <div className="floating-label label-bottom">
              <Globe2 size={18} /> One family. A world of ideas.
            </div>
          </div>
        </section>
        <section className="trust-band">
          <div className="wrap">
            <span>
              <Users /> More connection
            </span>
            <span>
              <Sparkles /> Real curiosity
            </span>
            <span>
              <Globe2 /> Bigger perspectives
            </span>
            <span>
              <ShieldCheck /> Guardian-led play
            </span>
          </div>
        </section>
        <section className="section wrap" id="zones">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FIVE WAYS TO SAY “ONE MORE ROUND”</p>
              <h2>Find your kind of adventure.</h2>
            </div>
            <p>
              A quick spark or a big idea.
              <br />
              There’s a Zone for every curious family.
            </p>
          </div>
          <div className="zone-grid">
            {zones.map((z) => (
              <Link
                className={"zone-card zone-" + z.mode}
                href="/challenges"
                key={z.mode}
              >
                <span className="zone-icon" style={{ background: z.color }}>
                  {z.icon}
                </span>
                <small>{z.tag}</small>
                <h3>{z.name}</h3>
                <p>{z.description}</p>
                <span className="zone-link">
                  Explore {z.name} <ArrowRight size={17} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="section how-section" id="how">
          <div className="wrap">
            <p className="eyebrow">LESS SETUP. MORE TOGETHER.</p>
            <h2>
              Your next great family night
              <br />
              is three little steps away.
            </h2>
            <div className="steps">
              {steps.map(([n, t, d]) => (
                <article key={n}>
                  <span>{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="section wrap safety-section" id="safety">
          <div className="safety-visual">
            <div className="shield-art">
              <ShieldCheck size={100} />
            </div>
            <span className="safety-note">Curiosity needs room to grow.</span>
          </div>
          <div>
            <p className="eyebrow">THEIR WORLD. YOUR GUIDANCE.</p>
            <h2>
              Made for little explorers.
              <br />
              With grown-ups in mind.
            </h2>
            <p>
              Stay part of the adventure. You choose who plays and which
              experiences your family explores.
            </p>
            <ul className="checklist">
              <li>
                <Check /> Guardian-managed family profiles
              </li>
              <li>
                <Check /> Guided activities, without open chat
              </li>
              <li>
                <Check /> A record of your family’s learning journey
              </li>
            </ul>
            <Link href="/signup" className="text-link">
              Build your family’s space <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="section wrap faq">
          <p className="eyebrow">GOOD QUESTIONS. HONEST ANSWERS.</p>
          <h2>A few things you might be wondering.</h2>
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="wrap final-cta">
          <span>✦</span>
          <p className="eyebrow">MAKE ROOM FOR A LITTLE WONDER</p>
          <h2>
            The best part?
            <br />
            You’re in this together.
          </h2>
          <Link href="/signup" className="btn">
            Start your family adventure <ArrowRight size={18} />
          </Link>
          <p>Play Together. Solve the World.</p>
        </section>
      </main>
      <footer className="wrap footer">
        <Brand />
        <p>Big curiosity. Shared adventures.</p>
        <div>
          <a href="#safety">Family safety</a>
          <a href="#how">How it works</a>
          <Link href="/login">Guardian login</Link>
        </div>
        <small>© {new Date().getFullYear()} QuiZone</small>
      </footer>
    </>
  );
}
