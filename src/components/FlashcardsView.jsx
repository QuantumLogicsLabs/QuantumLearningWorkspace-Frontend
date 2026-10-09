import { useState, useEffect, useCallback } from "react";
import { Layers, AlertTriangle, CheckCircle2, RotateCcw, RotateCw, Lightbulb, Trophy, Star, Volume2, VolumeX, Keyboard, Shuffle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import "./FlashcardsView.css";
import CustomSelect from "./CustomSelect.jsx";
import SourceSelector from "./SourceSelector.jsx";

const QUICK_TOPICS = [
  "Quantum Computing",
  "Machine Learning",
  "Python",
  "Data Structures",
  "Cell Biology",
  "Organic Chemistry",
];

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function FlashcardsView({ initialContext }) {
  const { token, handle401 } = useAuth();
  const { showToast } = useToast();

  // Generation Form State
  const [topicInput, setTopicInput] = useState(initialContext?.topic || "");
  const [numCards, setNumCards] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Source mode: generate from any topic, or scoped to an uploaded document
  const [sourceMode, setSourceMode] = useState(initialContext?.document_id ? "document" : "topic");
  const [docFiles, setDocFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(initialContext?.document_id || "");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/uploads`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setDocFiles(data);
      })
      .catch(() => {});
  }, [token]);

  const getCleanTopicFromFilename = (filename) => {
    if (!filename) return "";
    const withoutExt = filename.replace(/\.[^/.]+$/, "");
    return withoutExt.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
  };

  const handleSelectDocFile = (fileId) => {
    setSelectedFileId(fileId);
    const file = docFiles.find((f) => String(f.id) === String(fileId));
    if (file) {
      setTopicInput(getCleanTopicFromFilename(file.filename));
    }
  };

  const handleSourceModeChange = (mode) => {
    setSourceMode(mode);
    if (mode === "topic") {
      setSelectedFileId("");
    }
  };

  // Flashcards Study Deck State
  const [currentTopic, setCurrentTopic] = useState(initialContext?.topic || "");
  const [cards, setCards] = useState(initialContext?.cards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardReviews, setCardReviews] = useState({}); // { [cardId]: 'known' | 'still_learning' }
  const [bookmarkedCards, setBookmarkedCards] = useState(new Set());
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (initialContext && Array.isArray(initialContext.cards) && initialContext.cards.length > 0) {
      setCards(initialContext.cards);
      setCurrentTopic(initialContext.topic || "Document Study Deck");
      if (initialContext.topic) setTopicInput(initialContext.topic);
      setCurrentIndex(0);
      setIsFlipped(false);
      setCardReviews({});
      setIsCompleted(false);
    }
  }, [initialContext]);

  // Generate Flashcards Handler
  const handleGenerateFlashcards = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg("");

    const chosenTopic = topicInput.trim();
    if (!chosenTopic) {
      setErrorMsg("Please enter or select a topic to generate flashcards.");
      return;
    }

    setIsGenerating(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/generate-flashcards`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          topic: chosenTopic,
          num_cards: Number(numCards),
            difficulty,
            ...(sourceMode === "document" && selectedFileId ? { document_id: selectedFileId } : {}),
          }),
      });

      if (response.status === 401) {
        handle401();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (!data.cards || data.cards.length === 0) {
        throw new Error("No flashcards could be generated for this topic.");
      }

      setCards(data.cards);
      setCurrentTopic(data.topic || chosenTopic);
      setCurrentIndex(0);
      setIsFlipped(false);
      setCardReviews({});
      setIsCompleted(false);

      try {
        localStorage.setItem(
          "studymind_last_activity",
          JSON.stringify({
            topic: data.topic || chosenTopic,
            type: "flashcards",
            subText: `${data.cards.length} Flashcards session`,
            targetTab: "flashcards",
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        // Ignore localStorage quota errors
      }

      showToast(`Generated ${data.cards.length} flashcards for "${data.topic || chosenTopic}"!`, "success");
    } catch (err) {
      console.error("Flashcards generation error:", err);
      setErrorMsg(err.message || "Failed to generate flashcards. Please try again.");
      showToast(err.message || "Failed to generate flashcards", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick Chip Select
  const handleChipClick = (t) => {
    setTopicInput(t);
  };

  // Card Flip Toggle
  const handleCardClick = () => {
    setIsFlipped((prev) => !prev);
  };

  // Toggle Star / Bookmark on Current Card
  const handleToggleBookmark = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!cards.length) return;
    const currentCard = cards[currentIndex];
    if (!currentCard) return;
    const cardId = currentCard.id || `card-${currentIndex}`;
    setBookmarkedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
        showToast("Card unstarred", "info");
      } else {
        next.add(cardId);
        showToast("Card starred for review", "success");
      }
      return next;
    });
  };

  // Text-to-Speech (Audio Pronunciation & Listen)
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeakText = (e, text) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!("speechSynthesis" in window)) {
      showToast("Speech synthesis not supported in this browser", "info");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentIndex, isFlipped]);

  // Review Action: "known" or "still_learning"
  const handleReviewAction = async (status) => {
    if (!cards.length || isSavingReview) return;
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    setIsSavingReview(true);
    const cardId = currentCard.id || `card-${currentIndex}`;

    // Update local state immediately
    const updatedReviews = {
      ...cardReviews,
      [cardId]: status,
    };
    setCardReviews(updatedReviews);

    // Call Backend API
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/flashcards/review`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          flashcard_id: cardId,
          topic: currentTopic,
          status,
        }),
      });

      if (response.status === 401) {
        handle401();
        return;
      }

      if (!response.ok) {
        console.warn(`Review save returned ${response.status}`);
      }
    } catch (err) {
      console.warn("Failed to sync review status with backend:", err);
    } finally {
      setIsSavingReview(false);
    }

    // Advance to next card or complete deck
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      showToast("Deck completed successfully! Review your performance below.", "success");
    }
  };

  // Navigation: Next / Prev
  const handleNextCard = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Shuffle Deck
  const handleShuffleDeck = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    showToast("Deck shuffled!", "info");
  };

  // Restart Deck
  const handleRestartDeck = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardReviews({});
    setIsCompleted(false);
  };

  // Review Only Weak Cards
  const handleReviewWeakCards = () => {
    const weakCards = cards.filter(
      (c, idx) => cardReviews[c.id || `card-${idx}`] === "still_learning"
    );
    if (weakCards.length === 0) {
      showToast("No cards marked as Still Learning! You mastered all cards!", "success");
      handleRestartDeck();
      return;
    }
    setCards(weakCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardReviews({});
    setIsCompleted(false);
    showToast(`Studying ${weakCards.length} cards needing practice`, "info");
  };

  // Review Only Starred / Bookmarked Cards
  const handleReviewStarredCards = () => {
    const starredCards = cards.filter((c, idx) =>
      bookmarkedCards.has(c.id || `card-${idx}`)
    );
    if (starredCards.length === 0) {
      showToast("No cards starred! Star difficult cards using the Star button or B", "info");
      return;
    }
    setCards(starredCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardReviews({});
    setIsCompleted(false);
    showToast(`Studying ${starredCards.length} starred flashcards`, "info");
  };

  // Keyboard Shortcuts (Space/Enter to flip, Left/Right arrows to navigate)
  const handleKeyDown = useCallback(
    (e) => {
      if (!cards.length || isCompleted) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

      if (e.code === "Space" || e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === "1") {
        e.preventDefault();
        handleReviewAction("still_learning");
      } else if (e.key === "2") {
        e.preventDefault();
        handleReviewAction("known");
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        handleToggleBookmark();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleShuffleDeck();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRestartDeck();
      }
    },
    [cards, currentIndex, isCompleted, handleToggleBookmark, handleNextCard, handlePrevCard, handleReviewAction, handleShuffleDeck, handleRestartDeck]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Derived Metrics
  const knownCount = Object.values(cardReviews).filter((s) => s === "known").length;
  const learningCount = Object.values(cardReviews).filter((s) => s === "still_learning").length;
  const currentCard = cards[currentIndex];
  const currentCardId = currentCard ? (currentCard.id || `card-${currentIndex}`) : null;
  const currentCardStatus = currentCard ? cardReviews[currentCardId] : null;
  const isCurrentBookmarked = currentCardId ? bookmarkedCards.has(currentCardId) : false;
  const bookmarkedCount = bookmarkedCards.size;
  const progressPercent = cards.length ? Math.round(((currentIndex + (currentCardStatus ? 1 : 0)) / cards.length) * 100) : 0;

  return (
    <div className="flashcards-container">
      {/* ─── Topic Setup Section ────────────────────────────────────────────── */}
      <section className="flashcards-setup-card">
        <div className="flashcards-setup-header">
          <div className="flashcards-setup-icon"><Layers size={24} /></div>
          <div>
            <h2 className="flashcards-setup-title">Create Flashcards</h2>
            <p className="flashcards-setup-subtitle">
              Select or type any topic to generate active recall study cards
            </p>
          </div>
        </div>

        <SourceSelector
            mode={sourceMode}
            onModeChange={handleSourceModeChange}
            documents={docFiles}
            selectedDocumentId={selectedFileId}
            onSelectDocument={handleSelectDocFile}
            disabled={isGenerating}
          />

          <form onSubmit={handleGenerateFlashcards} className="flashcards-form">
            

            <div className="flashcards-input-group">
              <label className="flashcards-label" htmlFor="flashcard-topic">
                {sourceMode === "document" ? "Focus Topic (from selected document):" : "Study Topic:"}
              </label>
              <div className="flashcards-input-row">
                <input
                  id="flashcard-topic"
                  type="text"
                  className="flashcards-topic-input"
                  placeholder={
                    sourceMode === "document"
                      ? "e.g. leave as document title, or narrow to a section..."
                      : "e.g. Quantum Computing, Machine Learning, Photosynthesis..."
                  }
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                disabled={isGenerating}
              />
              <CustomSelect
                className="flashcards-custom-select"
                value={numCards}
                onChange={(val) => setNumCards(Number(val))}
                options={[
                  { value: 5, label: "5 Cards" },
                  { value: 10, label: "10 Cards" },
                  { value: 15, label: "15 Cards" },
                  { value: 20, label: "20 Cards" },
                ]}
                disabled={isGenerating}
                title="Number of cards"
              />
              <CustomSelect
                className="flashcards-custom-select"
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                ]}
                disabled={isGenerating}
                title="Difficulty level"
              />
              <button
                type="submit"
                className="flashcards-generate-btn"
                disabled={isGenerating || !topicInput.trim()}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }}></span>
                    Generating...
                  </>
                ) : (
                  "Generate Flashcards"
                )}
              </button>
            </div>

            {/* Quick Topic Chips */}
            <div className="flashcards-topic-chips">
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", alignSelf: "center" }}>
                Suggested:
              </span>
              {QUICK_TOPICS.map((topic) => (
                <button
                  type="button"
                  key={topic}
                  className="flashcard-topic-chip"
                  onClick={() => handleChipClick(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="flashcards-error-banner">
              <AlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: "6px" }} />{errorMsg}
            </div>
          )}
        </form>
      </section>

      {/* ─── Active Study Deck View ─────────────────────────────────────────── */}
      {cards.length > 0 && !isCompleted && (
        <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Deck Header & Progress Bar */}
          <div className="flashcards-deck-header">
            <div className="flashcards-deck-info">
              <span className="flashcards-topic-tag">{currentTopic}</span>
              <span className="flashcards-counter-text">
                Card {currentIndex + 1} of {cards.length}
              </span>
            </div>
            <div className="flashcards-stats-pills">
              <span className="stat-pill known" title="Marked as Known">
                <CheckCircle2 size={13} /> Known: {knownCount}
              </span>
              <span className="stat-pill learning" title="Marked as Still Learning">
                <RotateCcw size={13} /> Learning: {learningCount}
              </span>
              {bookmarkedCount > 0 && (
                <span className="stat-pill bookmarked" title="Starred for review">
                  <Star size={13} fill="currentColor" /> Starred: {bookmarkedCount}
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flashcards-progress-track">
            <div
              className="flashcards-progress-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* 3D Flip Flashcard */}
          <div
            className={`flashcard-scene ${isFlipped ? "is-flipped" : ""}`}
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            aria-label="Flashcard. Click or press space to flip."
          >
            <div className="flashcard-inner">
              {/* Front Face: Question */}
              <div className="flashcard-face flashcard-face-front">
                <div className="flashcard-badge-row">
                  <span className="flashcard-type-badge">Question</span>
                  <div className="flashcard-badge-actions">
                    {currentCardStatus && (
                      <span className={`flashcard-status-indicator ${currentCardStatus}`}>
                        {currentCardStatus === "known" ? (<><CheckCircle2 size={13} /> Marked Known</>) : (<><RotateCcw size={13} /> Still Learning</>)}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`flashcard-audio-btn ${isSpeaking ? "speaking" : ""}`}
                      onClick={(e) => handleSpeakText(e, currentCard?.front || currentCard?.question || "")}
                      title={isSpeaking ? "Stop audio" : "Listen to question"}
                      aria-label="Listen to question"
                    >
                      {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button
                      type="button"
                      className={`flashcard-star-btn ${isCurrentBookmarked ? "active" : ""}`}
                      onClick={handleToggleBookmark}
                      title={isCurrentBookmarked ? "Unstar card (B)" : "Star card for review (B)"}
                      aria-label="Star this card"
                    >
                      <Star size={16} fill={isCurrentBookmarked ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>

                <div className="flashcard-body-text">
                  {currentCard?.front || currentCard?.question || "No question available"}
                </div>

                <div className="flashcard-flip-prompt">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Click or tap card to reveal answer (or press Space)
                </div>
              </div>

              {/* Back Face: Answer */}
              <div className="flashcard-face flashcard-face-back">
                <div className="flashcard-badge-row">
                  <span className="flashcard-type-badge"><Lightbulb size={13} /> Answer &amp; Explanation</span>
                  <div className="flashcard-badge-actions">
                    {currentCardStatus && (
                      <span className={`flashcard-status-indicator ${currentCardStatus}`}>
                        {currentCardStatus === "known" ? (<><CheckCircle2 size={13} /> Marked Known</>) : (<><RotateCcw size={13} /> Still Learning</>)}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`flashcard-audio-btn ${isSpeaking ? "speaking" : ""}`}
                      onClick={(e) => handleSpeakText(e, currentCard?.back || currentCard?.answer || "")}
                      title={isSpeaking ? "Stop audio" : "Listen to explanation"}
                      aria-label="Listen to explanation"
                    >
                      {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button
                      type="button"
                      className={`flashcard-star-btn ${isCurrentBookmarked ? "active" : ""}`}
                      onClick={handleToggleBookmark}
                      title={isCurrentBookmarked ? "Unstar card (B)" : "Star card for review (B)"}
                      aria-label="Star this card"
                    >
                      <Star size={16} fill={isCurrentBookmarked ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>

                <div className="flashcard-body-text">
                  {currentCard?.back || currentCard?.answer || "No answer available"}
                </div>

                <div className="flashcard-flip-prompt">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Click to flip back to question
                </div>
              </div>
            </div>
          </div>

          {/* Study Progress Actions: "Still Learning" (Amber) and "Known" (Green) */}
          <div className="flashcards-action-bar">
            <button
              type="button"
              className="study-action-btn btn-learning"
              onClick={() => handleReviewAction("still_learning")}
              disabled={isSavingReview}
              title="Press 1 on keyboard"
            >
              <RotateCcw size={15} /> Still Learning
              <kbd className="action-kbd-hint">1</kbd>
            </button>
            <button
              type="button"
              className="study-action-btn btn-known"
              onClick={() => handleReviewAction("known")}
              disabled={isSavingReview}
              title="Press 2 on keyboard"
            >
              <CheckCircle2 size={15} /> Known
              <kbd className="action-kbd-hint">2</kbd>
            </button>
          </div>

          {/* Secondary Deck Navigation */}
          <div className="flashcards-nav-controls">
            <button
              type="button"
              className="secondary-nav-btn"
              onClick={handlePrevCard}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <div className="secondary-nav-center-group">
              <button
                type="button"
                className="secondary-nav-btn"
                onClick={handleShuffleDeck}
                title="Shuffle cards randomly (S)"
              >
                <Shuffle size={14} /> Shuffle
              </button>
              <button
                type="button"
                className="secondary-nav-btn"
                onClick={handleRestartDeck}
                title="Restart deck from first card (R)"
              >
                <RotateCw size={14} /> Reset
              </button>
            </div>
            <button
              type="button"
              className="secondary-nav-btn"
              onClick={handleNextCard}
              disabled={currentIndex === cards.length - 1}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>

          {/* Keyboard Shortcuts Legend Bar */}
          <div className="flashcards-shortcuts-bar">
            <span className="shortcuts-bar-title">
              <Keyboard size={14} /> Shortcuts:
            </span>
            <div className="shortcuts-chip-group">
              <span className="shortcut-chip"><kbd>Space</kbd> / <kbd>F</kbd> Flip</span>
              <span className="shortcut-chip"><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
              <span className="shortcut-chip"><kbd>1</kbd> Learning</span>
              <span className="shortcut-chip"><kbd>2</kbd> Known</span>
              <span className="shortcut-chip"><kbd>B</kbd> Star</span>
              <span className="shortcut-chip"><kbd>S</kbd> Shuffle</span>
              <span className="shortcut-chip"><kbd>R</kbd> Reset</span>
            </div>
          </div>
        </section>
      )}

      {/* ─── Completed Deck Summary Screen ─────────────────────────────────── */}
      {isCompleted && (
        <section className="flashcards-summary-card">
          <div className="summary-trophy-icon"><Trophy size={32} /></div>
          <h3 className="summary-title">Deck Completed!</h3>
          <p className="summary-desc">
            You reviewed all {cards.length} flashcards for <strong>{currentTopic}</strong>.
          </p>

          <div className="summary-metrics-grid">
            <div className="summary-metric-box">
              <span className="summary-metric-val">{cards.length}</span>
              <span className="summary-metric-lbl">Total Cards</span>
            </div>
            <div className="summary-metric-box">
              <span className="summary-metric-val known">{knownCount}</span>
              <span className="summary-metric-lbl">Known</span>
            </div>
            <div className="summary-metric-box">
              <span className="summary-metric-val learning">{learningCount}</span>
              <span className="summary-metric-lbl">Still Learning</span>
            </div>
            <div className="summary-metric-box">
              <span className="summary-metric-val star">{bookmarkedCount}</span>
              <span className="summary-metric-lbl">Starred</span>
            </div>
          </div>

          <div className="summary-actions-row">
            {bookmarkedCount > 0 && (
              <button
                type="button"
                className="study-action-btn btn-starred-practice"
                onClick={handleReviewStarredCards}
                style={{ maxWidth: "250px" }}
              >
                <Star size={15} fill="currentColor" /> Practice {bookmarkedCount} Starred
              </button>
            )}
            {learningCount > 0 && (
              <button
                type="button"
                className="study-action-btn btn-learning"
                onClick={handleReviewWeakCards}
                style={{ maxWidth: "240px" }}
              >
                <RotateCcw size={15} /> Practice {learningCount} Weak Cards
              </button>
            )}
            <button
              type="button"
              className="study-action-btn btn-known"
              onClick={handleRestartDeck}
              style={{ maxWidth: "200px" }}
            >
              <RotateCw size={15} /> Study Again
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
