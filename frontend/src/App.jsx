import { useState } from 'react';
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

function App() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);


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
        const response = await axios.post(`${BACKEND_URL}/query`, {
          question: question,
          session_id: sessionId,
        });
        data = response.data;
      }

      setResult(data);
      setSessionId(data.session_id);

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
          <h2>Answer</h2>
          <p className="answer">{result.answer}</p>

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