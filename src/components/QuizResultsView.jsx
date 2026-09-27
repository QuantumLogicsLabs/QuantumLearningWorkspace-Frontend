import { useState, useEffect } from "react";
import { BarChart3, AlertTriangle, Target, TrendingUp, CheckCircle2, XCircle, Map as MapIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import "./QuizResultsView.css";
import CustomSelect from "./CustomSelect.jsx";

export default function QuizResultsView({ onLaunchRoadmap }) {
  const { token, handle401 } = useAuth();
  const { showToast } = useToast();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);
  const [filterTopic, setFilterTopic] = useState("All");
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  // Fetch quiz results
  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    fetch(`${API_BASE}/quiz-results`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (handle401(res)) return;
        if (!res.ok) throw new Error("Failed to fetch quiz results");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const valid = data.filter(
            (r) => r && (r.topic || r.question || r.selected_answer || r.question_id)
          );
          setResults(valid);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load quiz results");
        showToast(err.message || "Failed to load quiz results", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  // Format date safely
  const formatQuizDate = (dateStr) => {
    if (!dateStr) return "Date unavailable";
    try {
      const parsed = new Date(
        !dateStr.endsWith("Z") && !dateStr.includes("+") ? dateStr + "Z" : dateStr
      );
      if (isNaN(parsed.getTime())) return "Date unavailable";
      return parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Date unavailable";
    }
  };

  // Group individual question results into cohesive quiz attempts
  const groupResultsIntoQuizzes = (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];

    const valid = items.filter(
      (r) => r && (r.topic || r.question || r.selected_answer || r.question_id)
    );

    // Sort newest first
    const sorted = [...valid].sort((a, b) => {
      const tA = a.date_taken ? new Date(a.date_taken).getTime() : 0;
      const tB = b.date_taken ? new Date(b.date_taken).getTime() : 0;
      return tB - tA;
    });

    const groups = [];

    for (const item of sorted) {
      const rawTopic = (item.topic || "General").trim();
      const itemTimestamp = item.date_taken ? new Date(item.date_taken).getTime() : 0;

      // Grouping logic:
      // 1. If item has quiz_id, group by exact quiz_id
      // 2. Otherwise group by same topic (case-insensitive) taken within 5 minutes of each other
      let target = null;
      if (item.quiz_id) {
        target = groups.find((g) => g.quiz_id && g.quiz_id === item.quiz_id);
      }

      if (!target && itemTimestamp) {
        target = groups.find((g) => {
          if (g.topic.toLowerCase() !== rawTopic.toLowerCase()) return false;
          return Math.abs(g.timestamp - itemTimestamp) <= 300000;
        });
      }

      if (target) {
        target.questions.push(item);
      } else {
        const id = item.quiz_id || `${rawTopic.toLowerCase()}-${itemTimestamp || Date.now()}-${groups.length}`;
        groups.push({
          id,
          quiz_id: item.quiz_id || null,
          topic: rawTopic,
          date: item.date_taken,
          timestamp: itemTimestamp,
          questions: [item],
        });
      }
    }

    return groups;
  };

  const allQuizGroups = groupResultsIntoQuizzes(results);

  // Filter groups by topic
  const filteredQuizGroups = filterTopic === "All"
    ? allQuizGroups
    : allQuizGroups.filter((g) => g.topic.toLowerCase() === filterTopic.toLowerCase());

  // Calculate statistics based on grouped quizzes & total questions
  const calculateStats = () => {
    if (results.length === 0) {
      return { totalQuizzes: 0, avgScore: 0, totalQuestions: 0, correctAnswers: 0 };
    }

    const totalQuestions = results.length;
    const correctAnswers = results.filter((r) => r.is_correct).length;
    const avgScore = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    return {
      totalQuizzes: allQuizGroups.length,
      avgScore,
      totalQuestions,
      correctAnswers,
    };
  };

  // Get unique topics for dropdown
  const getTopics = () => {
    const topicMap = {};
    for (const g of allQuizGroups) {
      const lower = g.topic.toLowerCase();
      if (!topicMap[lower]) {
        topicMap[lower] = g.topic;
      }
    }
    return ["All", ...Object.values(topicMap)];
  };

  const stats = calculateStats();
  const topics = getTopics();

  // Render empty state
  if (!loading && results.length === 0) {
    return (
      <div className="quiz-results-view">
        <div className="empty-state-card">
          <BarChart3 className="empty-icon" size={40} strokeWidth={1.75} />
          <h3 className="empty-title">No Quiz Results Yet</h3>
          <p className="empty-subtitle">
            Take a quiz to see your results and track your progress
          </p>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="quiz-results-view">
        <div className="loading-state">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p className="loading-text">Loading your quiz results...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="quiz-results-view">
        <div className="error-state-card">
          <AlertTriangle className="error-icon" size={18} />
          <p className="error-text">{error}</p>
          <button
            className="btn-retry"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-results-view">
      {/* Stats Cards */}
      <div className="results-stats">
        <div className="stat-card">
          <div className="stat-icon"><Target size={22} /></div>
          <div className="stat-value">{stats.totalQuizzes}</div>
          <div className="stat-label">Quizzes Taken</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={22} /></div>
          <div className="stat-value">{stats.avgScore}%</div>
          <div className="stat-label">Average Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle2 size={22} /></div>
          <div className="stat-value">
            {stats.correctAnswers}/{stats.totalQuestions}
          </div>
          <div className="stat-label">Correct Answers</div>
        </div>
      </div>

      {/* Filter & Controls */}
      <div className="results-controls">
        <div className="filter-group">
          <label className="filter-label">Filter by Topic:</label>
          <CustomSelect
            value={filterTopic}
            onChange={setFilterTopic}
            options={topics}
          />
        </div>
      </div>

      {/* Quiz Results List */}
      <div className="results-list">
        {filteredQuizGroups.length === 0 ? (
          <div className="no-results-card">
            <p>No results found for the selected topic</p>
          </div>
        ) : (
          filteredQuizGroups.map((group) => {
            const correctCount = group.questions.filter((q) => q.is_correct).length;
            const totalCount = group.questions.length;
            const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
            const key = group.id;

            return (
              <div key={key} className="result-group-card">
                <div className="result-header">
                  <div className="result-info">
                    <h3 className="result-topic">{group.topic}</h3>
                    <p className="result-date">{formatQuizDate(group.date)}</p>
                    <div className="overall-score-tag">
                      <span className="overall-score-tag-label">Overall Score:</span>
                      <strong className="overall-score-tag-value">
                        {correctCount}/{totalCount} ({scorePercent}%)
                      </strong>
                    </div>
                  </div>
                  <div className="result-score">
                    <div className={`score-circle ${scorePercent >= 70 ? "good" : scorePercent >= 50 ? "fair" : "poor"}`}>
                      <span className="score-percent">{scorePercent}%</span>
                    </div>
                  </div>
                </div>

                <div className="result-stats-row">
                  <span className="result-stat">
                    <strong>{correctCount}</strong> Correct
                  </span>
                  <span className="result-stat">
                    <strong>{totalCount - correctCount}</strong> Incorrect
                  </span>
                  <span className="result-stat">
                    <strong>{totalCount}</strong> Total
                  </span>
                </div>

                <button
                  className="btn-view-details"
                  onClick={() => setSelectedResult(selectedResult === key ? null : key)}
                >
                  {selectedResult === key ? "Hide Details" : "View Details"}
                </button>

                {/* Detailed Results */}
                {selectedResult === key && (
                  <div className="result-details">
                    <div className="details-header-row">
                      <h4 className="details-section-title">Question Breakdown</h4>
                      <span className="overall-score-summary">
                        Overall Score: <strong>{correctCount}/{totalCount} ({scorePercent}%)</strong>
                      </span>
                    </div>

                    <div className="questions-review-list">
                      {group.questions.map((question, idx) => {
                        const isCorrect = Boolean(question.is_correct);
                        return (
                          <div
                            key={idx}
                            className={`question-review-card ${isCorrect ? "card-correct" : "card-incorrect"}`}
                          >
                            <div className="question-review-header">
                              <span className="question-number">Question {idx + 1}</span>
                              <span className={`quiz-badge ${isCorrect ? "badge-correct" : "badge-incorrect"}`}>
                                {isCorrect ? (
                                  <>
                                    <CheckCircle2 size={13} className="badge-icon" />
                                    <span>✓ Correct</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={13} className="badge-icon" />
                                    <span>✗ Incorrect</span>
                                  </>
                                )}
                              </span>
                            </div>

                            {question.question && (
                              <p className="question-statement">{question.question}</p>
                            )}

                            <div className="answer-comparison-grid">
                              <div className={`answer-box user-answer-box ${isCorrect ? "is-correct" : "is-incorrect"}`}>
                                <span className="answer-box-label">Your Answer:</span>
                                <span className="answer-box-text">
                                  {question.selected_answer || "No answer provided"}
                                </span>
                              </div>

                              <div className="answer-box correct-answer-box">
                                <span className="answer-box-label">Correct Answer:</span>
                                <span className="answer-box-text">
                                  {question.correct_answer || "—"}
                                </span>
                              </div>
                            </div>

                            {question.explanation && (
                              <div className="question-explanation-box">
                                <span className="explanation-label">💡 Explanation:</span>
                                <p className="explanation-text">{question.explanation}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Roadmap CTA — calls quiz-performance mode */}
      <div className="topics-to-review-card">
        <h3><MapIcon size={16} style={{ verticalAlign: "middle", marginRight: "6px" }} />Generate Your Study Roadmap</h3>
        <p className="placeholder-text">
          Based on your quiz history, our AI will detect your weak topics and build a personalised study roadmap to help you improve.
        </p>
        <button
          className="btn-launch-roadmap-from-results"
          disabled={isRoadmapLoading || results.length === 0}
          onClick={async () => {
            setIsRoadmapLoading(true);
            try {
              const headers = { "Content-Type": "application/json" };
              if (token) headers["Authorization"] = `Bearer ${token}`;
              const res = await fetch(`${API_BASE}/roadmap/generate-from-quiz-performance`, {
                method: "POST",
                headers,
              });
              const data = await res.json();
              if (data && data.success && Array.isArray(data.next_steps) && data.next_steps.length > 0) {
                if (onLaunchRoadmap) {
                  onLaunchRoadmap({ next_steps: data.next_steps, subject: data.subject });
                }
              } else {
                showToast(data.subject || "No weak topics detected yet — take more quizzes first!", "error");
              }
            } catch {
              showToast("Could not generate roadmap right now. Please try again.", "error");
            } finally {
              setIsRoadmapLoading(false);
            }
          }}
        >
          {isRoadmapLoading ? (
            <>
              <span className="mini-action-spinner" style={{ marginRight: "8px" }}></span>
              Generating Roadmap...
            </>
          ) : (
            <>
              <MapIcon size={15} style={{ marginRight: "7px" }} />
              Generate My Study Roadmap
            </>
          )}
        </button>
        {results.length === 0 && !loading && (
          <p className="roadmap-cta-hint">Take at least one quiz to unlock roadmap generation.</p>
        )}
      </div>
    </div>
  );
}
