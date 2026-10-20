import { useState } from 'react';
import { useState, useRef } from 'react';
import axios from 'axios';
import { BACKEND_URL, APP_TITLE, PLACEHOLDER_QUESTION } from './config';
import './App.css';

// Flip this to false once your teammate's /query endpoint is actually running.
// Keeping it as a flag (instead of deleting code) means you can switch back
// instantly if the backend goes down again while you're still testing.
const USE_FAKE_DATA = false;

const FAKE_RESPONSE = {
  answer:
    'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without explicit programming.',
  answer_mode: 'hybrid',
  citations: [
    { chunk_id: 'doc1_chunk0', claim: 'ML trains algorithms on data' },
  ],
  retrieved_chunks: [
    {
      chunk_id: 'doc1_chunk0',
      text: 'Machine learning involves training algorithms on data so they can make predictions or decisions without being explicitly programmed for the task.',
      source_doc: 'document1.txt',
      similarity_score: 0.89,
    },
    {
      chunk_id: 'doc2_chunk3',
      text: 'AI and machine learning are transforming industries by automating complex decision-making processes.',
      source_doc: 'document2.txt',
      similarity_score: 0.75,
    },
  ],
};
const MODE_CONFIG = {
  grounded: { label: 'From your documents', color: '#16a34a' },
  hybrid: { label: 'Mixed: documents + general knowledge', color: '#ca8a04' },
  general: { label: 'General knowledge, not from your documents', color: '#dc2626' },
};

function ModeBadge({ mode }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.general;
  return (
    <span
      style={{
        background: config.color,
        color: 'white',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        marginLeft: '8px',
      }}
    >
      {config.label}
    </span>
  );
}

function App() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
const chunkRefs = useRef({});

const scrollToChunk = (chunkId) => {
  const el = chunkRefs.current[chunkId];
  if (el) {
    el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
  const handleSearch = async () => {
    if (!question.trim()) {
      setError('Please enter a question!');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let data;

      if (USE_FAKE_DATA) {
        // Simulate a little network delay so the loading state is visible
        await new Promise((resolve) => setTimeout(resolve, 500));
        data = FAKE_RESPONSE;
      } else {
      setError(err.response?.data?.detail || `Error: ${err.message}`);
}

      setResult(data);
      setChatHistory((prev) => [...prev, { question, answer: data.answer }]);
    } catch (err) {
      if (err.code === 'ERR_NETWORK') {
        setError('Could not connect to backend. Is it running?');
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
<details
  key={chunk.chunk_id ?? i}
  ref={(el) => (chunkRefs.current[chunk.chunk_id] = el)}
  className="chunk"
></details>
  return (
    <div className="app">
      <h1>{APP_TITLE}</h1>
      <p className="subtitle">Ask questions about our documents and get answers!</p>

      <div className="input-section">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER_QUESTION}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && !error && (
        <div className="results">
          <h2>
              Answer
              {result.answer_mode && <ModeBadge mode={result.answer_mode} />}
          </h2>
          <p className="answer">{result.answer}</p>
          {result.citations?.length > 0 && (
  <div className="citations">
    {result.citations.map((c, i) => (
      <button key={i} onClick={() => scrollToChunk(c.chunk_id)} style={{ marginRight: '6px' }}>
        [{c.chunk_id}]
      </button>
    ))}
  </div>
)}
          <h2>📄 Retrieved Documents</h2>
          {result.retrieved_chunks?.map((chunk, i) => (
            <details key={chunk.chunk_id ?? i} className="chunk">
              <summary>
                Chunk {i + 1}
                {typeof chunk.similarity_score === 'number'
                  ? ` (Similarity: ${chunk.similarity_score.toFixed(2)})`
                  : ' (Similarity: N/A)'}
              </summary>
              <p>
                <strong>Source:</strong> {chunk.source_doc ?? 'Unknown'}
              </p>
              <p>
                <strong>Text:</strong> {chunk.text ?? 'N/A'}
              </p>
            </details>
          ))}
        </div>
      )}

      {chatHistory.length > 0 && (
        <div className="history">
          <h2>Chat History</h2>
          {chatHistory.map((item, i) => (
            <div key={i} className="history-item">
              <p>
                <strong>Q:</strong> {item.question}
              </p>
              <p>
                <strong>A:</strong> {item.answer}
              </p>
              <hr />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;