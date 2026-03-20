import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="app home-page">
      <header className="header">
        <h1>Survey utilities</h1>
        <p>Local tools for working with FAIMS survey and notebook specifications.</p>
      </header>
      <nav className="tool-index" aria-label="Available tools">
        <h2>Tools</h2>
        <ul className="tool-list">
          <li className="tool-item">
            <Link to="/schema-describer" className="tool-link">
              <span className="tool-name">Survey schema describer</span>
            </Link>
            <p className="tool-desc">
              Upload a JSON UI specification (survey or notebook schema) and generate a
              human-readable table of all questions—field name, form, section, type, and
              question content. Export as JSON, CSV, or Word for review.
            </p>
          </li>
          <li className="tool-item">
            <Link to="/survey-diff" className="tool-link">
              <span className="tool-name">Survey specification diff</span>
            </Link>
            <p className="tool-desc">
              Upload two specifications and compare them side by side: added, removed, or
              modified forms, sections, and questions, with generic metadata diffs. Generate a
              markdown or Word change summary grouped by form and section.
            </p>
          </li>
        </ul>
      </nav>
    </div>
  );
}
