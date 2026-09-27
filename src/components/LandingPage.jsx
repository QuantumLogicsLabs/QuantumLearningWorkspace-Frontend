import { useEffect, useRef, useState } from "react";
import { Brain, FileText, PlayCircle, Globe, CheckCircle2, Inbox, CreditCard, Share2, MessageSquare, Target, Network, Map, Trophy } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import "./LandingPage.css";

const FEATURES = [
  {
    icon: Inbox,
    title: "Learn from Any Source",
    body: "Drop in your lecture PDFs, YouTube videos or web articles. StudyMind pulls out the key takeaways and organizes them for you.",
    points: ["Clear takeaways from PDFs", "Turns video lectures into text"],
    size: "wide",
  },
  {
    icon: CreditCard,
    title: "Instant Flashcards",
    body: "Automatically turns your material into bite-sized revision cards, helping you remember more in half the time.",
    size: "tall",
    demo: "flashcard",
  },
  {
    icon: MessageSquare,
    title: "AI Tutor",
    body: "Ask anything about your coursework and get friendly, instant explanations backed directly by your notes.",
    points: ["Exact page & source references", "Ask follow-ups anytime"],
    size: "wide",
  },
  {
    icon: Target,
    title: "Smart Quizzes",
    body: "Test what you know with quick practice questions made straight from your notes, with instant feedback.",
    points: ["Instant scores & explanations", "Targets your weak spots"],
    size: "normal",
  },
  {
    icon: Network,
    title: "Knowledge Map",
    body: "See how all your topics connect so you understand the big picture instead of memorizing in isolation.",
    points: ["Visual map of your topics", "Links concepts across files"],
    size: "normal",
  },
  {
    icon: Map,
    title: "Study Roadmap",
    body: "Stay on track with a clear, step-by-step study plan and daily streaks that keep you motivated.",
    points: ["Clear learning milestones", "Daily streaks & progress tracking"],
    size: "normal",
  },
];

const FLASHCARDS = [
  {
    q: "What is the time complexity of BST deletion?",
    a: "O(h) — O(log n) balanced, O(n) worst case.",
  },
  {
    q: "What replaces a node with two children in BST deletion?",
    a: "Its in-order successor: the smallest node in the right subtree.",
  },
  {
    q: "Define an AVL tree.",
    a: "A self-balancing BST where subtree heights differ by at most 1.",
  },
];

function useParticleCanvas(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let animationId;
    let width, height;

    const resize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.6 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.4 + 0.15;
        this.color = Math.random() > 0.5 ? "124,58,237" : "6,182,212";
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = [];
      const count = Math.min(70, Math.floor((width * height) / 16000));
      for (let i = 0; i < count; i++) particles.push(new Particle());
    };

    const connect = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,58,237,${0.1 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      connect();
      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();
    window.addEventListener("resize", init);
    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(animationId);
    };
  }, [canvasRef]);
}

function FlashcardDemo() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const next = (e) => {
    e.stopPropagation();
    setFlipped(false);
    setTimeout(() => setIndex((i) => (i + 1) % FLASHCARDS.length), 150);
  };

  return (
    <div className="landing-flashcard-demo">
      <div
        className={`landing-flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setFlipped((f) => !f)}
      >
        <div className="landing-flashcard-face landing-flashcard-front">
          <span className="landing-flashcard-label">Question</span>
          <p>{FLASHCARDS[index].q}</p>
        </div>
        <div className="landing-flashcard-face landing-flashcard-back">
          <span className="landing-flashcard-label">Answer</span>
          <p>{FLASHCARDS[index].a}</p>
        </div>
      </div>
      <div className="landing-flashcard-controls">
        <span>{index + 1} / {FLASHCARDS.length}</span>
        <button onClick={next}>Next card →</button>
      </div>
    </div>
  );
}

export default function LandingPage({ onNavigate = () => {} }) {
  const canvasRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useParticleCanvas(canvasRef);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      setScrolled(scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing">
      <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
  <div className="logo">
    <Brain className="logo-icon" size={22} strokeWidth={2.25} />
    <span className="logo-text">StudyMind <span>AI</span></span>
  </div>
  <div className="nav-links">
    <a href="#features" onClick={(e) => {
      e.preventDefault();
      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
    }}>Features</a>
    <a href="#how-it-works" onClick={(e) => {
      e.preventDefault();
      document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
    }}>How it Works</a>
  </div>
  <div className="nav-actions">
    <ThemeToggle />
    <button className="btn-ghost" onClick={() => onNavigate("login")}>Log in</button>
    <button className="btn-cta" onClick={() => onNavigate("signup")}>Sign up</button>
  </div>
</nav>

      <section className="hero">
        <canvas ref={canvasRef} className="particle-canvas" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="dot" />
            Your notes, videos and articles — one workspace
          </div>
          <h1 className="hero-title">
            Learn smarter with your own <span className="highlight">AI study partner</span>
          </h1>
          <p className="hero-subtitle">
            Upload your material, ask questions grounded in what you actually studied
            and turn it into flashcards and quizzes automatically.
          </p>
          <div className="hero-tags">
            <span className="tag"><FileText size={14} /> PDFs</span>
            <span className="tag"><PlayCircle size={14} /> Lecture videos</span>
            <span className="tag"><Globe size={14} /> Web articles</span>
          </div>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => onNavigate("signup")}>
              Get started free
            </button>
            <button className="btn-secondary" onClick={() => {
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See how it works
            </button>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-header">
          <div className="section-badge">
            <span className="dot" />
            Features
          </div>
          <h2>Everything You Need to Learn & Retain</h2>
          <p>Stop losing material across a dozen tabs — StudyMind keeps all your learning connected.</p>
        </div>
        <div className="bento-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className={`bento-card ${f.size}`}>
              <div className="bento-icon"><f.icon size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              {f.points && (
                <ul>
                  {f.points.map((p) => (
                    <li key={p}><CheckCircle2 size={14} /> {p}</li>
                  ))}
                </ul>
              )}
              {f.demo === "flashcard" && <FlashcardDemo />}
            </div>
          ))}
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="features-header">
          <div className="section-badge">
            <span className="dot" />
            Simple 3-Step Flow
          </div>
          <h2>How StudyMind AI Works</h2>
          <p>Turn your textbooks, lectures and notes into real understanding in minutes.</p>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon-wrap">
              <FileText size={22} className="step-icon" />
            </div>
            <h3>1. Upload Your Content</h3>
            <p>Upload your lecture PDFs, YouTube videos or class notes. StudyMind instantly organizes your material so it's ready to study.</p>
            <div className="step-pill">PDFs • YouTube • Articles</div>
          </div>
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon-wrap">
              <Brain size={22} className="step-icon" />
            </div>
            <h3>2. Understand & Explore</h3>
            <p>Chat directly with your notes. Ask questions, clear tough doubts in simple words, and see how different topics connect.</p>
            <div className="step-pill">AI Q&A • Concept Maps</div>
          </div>
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon-wrap">
              <Trophy size={22} className="step-icon" />
            </div>
            <h3>3. Practice & Master</h3>
            <p>Lock in what you learned with quick flashcards, practice quizzes, and a clear study roadmap that keeps you consistent.</p>
            <div className="step-pill">Flashcards • Quizzes • Milestones</div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-card">
          <h2>Start turning your notes into knowledge</h2>
          <p>Free to start. No credit card required.</p>
          <button className="btn-primary" onClick={() => onNavigate("signup")}>
            Create your account
          </button>
        </div>
      </section>

      <footer className="footer">
        <div>
          <span className="logo-text">StudyMind <span>AI</span></span>
          <p>Your personal AI-powered learning workspace.</p>
        </div>
        <p className="footer-copy">© 2026 StudyMind AI</p>
      </footer>
    </div>
  );
}
