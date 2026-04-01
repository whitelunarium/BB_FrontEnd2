---
toc: True
layout: post
data: flask
title: Backend UI
description: An overview of backend UI for Flask Jinja
categories: ['Python Flask']
permalink: /python/flask/jinja_ui
menu: nav/flask.html
author: Vibha Mandayam
breadcrumb: True 
---

## 1. What is Backend UI?

A **Backend UI** is a web interface that allows admins, teachers, or managers to interact with your app's data and logic on the server side.

For example, it can let you:

- View a list of users
- Edit or delete records
- Manage data like events, tasks, or reports

This UI talks to the backend (server) and helps people use your app without needing code or APIs.

<style>
  .backend-ui-shell {
    --backend-bg: #08111f;
    --backend-panel: #0f1b31;
    --backend-panel-2: #13233f;
    --backend-border: rgba(148, 163, 184, 0.2);
    --backend-text: #e5eefc;
    --backend-muted: #9bb0d3;
    --backend-accent: #4cc9f0;
    --backend-accent-2: #80ed99;
    --backend-warn: #ffd166;
    max-width: 1100px;
    margin: 2rem auto;
    color: var(--backend-text);
    font-family: "Segoe UI", system-ui, sans-serif;
  }

  .backend-ui-hero {
    background:
      radial-gradient(circle at top right, rgba(76, 201, 240, 0.16), transparent 38%),
      linear-gradient(145deg, var(--backend-bg), #0c1630 55%, #13284a 100%);
    border: 1px solid var(--backend-border);
    border-radius: 24px;
    padding: 2rem;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
    margin-bottom: 1.5rem;
  }

  .backend-ui-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    background: rgba(76, 201, 240, 0.12);
    color: var(--backend-accent);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 1rem;
  }

  .backend-ui-kicker::before {
    content: "";
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: var(--backend-accent-2);
    box-shadow: 0 0 12px rgba(128, 237, 153, 0.7);
  }

  .backend-ui-hero h2 {
    margin: 0 0 0.75rem;
    font-size: clamp(2rem, 3vw, 3rem);
    line-height: 1.05;
  }

  .backend-ui-hero p {
    margin: 0;
    max-width: 760px;
    color: var(--backend-muted);
    font-size: 1rem;
    line-height: 1.7;
  }

  .backend-ui-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .backend-ui-card {
    background: linear-gradient(180deg, rgba(19, 35, 63, 0.92), rgba(12, 24, 44, 0.94));
    border: 1px solid var(--backend-border);
    border-radius: 18px;
    padding: 1.1rem 1.15rem;
  }

  .backend-ui-card h3 {
    margin: 0 0 0.45rem;
    font-size: 1rem;
    color: var(--backend-text);
  }

  .backend-ui-card p,
  .backend-ui-card li {
    color: var(--backend-muted);
    line-height: 1.65;
    font-size: 0.95rem;
  }

  .backend-ui-card ul {
    margin: 0;
    padding-left: 1rem;
  }

  .backend-ui-example {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 1rem;
    margin: 1.5rem 0 2rem;
  }

  .backend-status-panel {
    background: linear-gradient(180deg, #0d1528, #0a101d);
    border: 1px solid var(--backend-border);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
  }

  .backend-status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.9rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid var(--backend-border);
    font-size: 0.9rem;
    color: var(--backend-muted);
  }

  .backend-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.7rem;
    border-radius: 999px;
    background: rgba(128, 237, 153, 0.12);
    color: var(--backend-accent-2);
    font-weight: 700;
  }

  .backend-status-pill::before {
    content: "";
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: var(--backend-accent-2);
  }

  .backend-status-body {
    padding: 1rem;
  }

  .backend-json {
    margin: 0;
    padding: 1rem;
    background: #050b16;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    overflow-x: auto;
    color: #d9ecff;
    font-size: 0.95rem;
    line-height: 1.7;
  }

  .backend-json .json-key { color: #7cc7ff; }
  .backend-json .json-string { color: #baffc9; }

  .backend-code-panel {
    background: linear-gradient(180deg, #09111f, #060b14);
    border: 1px solid var(--backend-border);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
  }

  .backend-code-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid var(--backend-border);
    color: var(--backend-muted);
    font-size: 0.85rem;
  }

  .backend-code-bar strong {
    color: var(--backend-text);
    font-size: 0.95rem;
  }

  .backend-code-panel pre {
    margin: 0;
    padding: 1rem 1.1rem 1.25rem;
    overflow-x: auto;
    color: #dbe7ff;
    font-size: 0.86rem;
    line-height: 1.65;
    background: transparent;
  }

  .backend-ui-tip {
    margin-top: 1rem;
    padding: 0.9rem 1rem;
    border-radius: 16px;
    background: rgba(255, 209, 102, 0.1);
    border: 1px solid rgba(255, 209, 102, 0.18);
    color: #f7df9c;
  }

  @media (max-width: 900px) {
    .backend-ui-grid,
    .backend-ui-example {
      grid-template-columns: 1fr;
    }
  }
</style>

<section class="backend-ui-shell">
  <div class="backend-ui-hero">
    <div class="backend-ui-kicker">Backend UI Upgrade</div>
    <h2>Make the backend readable, useful, and presentable.</h2>
    <p>
      A backend page should do more than dump plain text into the browser. It should clearly show service status,
      explain what the server is doing, and present code examples in a way that is easy to scan for both students and reviewers.
    </p>
  </div>

  <div class="backend-ui-grid">
    <article class="backend-ui-card">
      <h3>What a good backend UI should show</h3>
      <ul>
        <li>Whether the service is online</li>
        <li>What environment or port it is using</li>
        <li>Clear routes or actions for testing the API</li>
        <li>Formatted responses instead of raw text blobs</li>
      </ul>
    </article>
    <article class="backend-ui-card">
      <h3>Why plain JSON feels unfinished</h3>
      <p>
        If the browser only shows something like <code>{"message":"Flask backend is running"}</code>, users learn almost nothing
        about what the backend can do next. A small amount of layout and hierarchy makes the page feel intentional.
      </p>
    </article>
    <article class="backend-ui-card">
      <h3>Recommended UI elements</h3>
      <p>
        Use a status badge, a formatted response panel, route examples, and a properly styled code sample. These four pieces
        usually cover the biggest readability problems.
      </p>
    </article>
  </div>

  <div class="backend-ui-example">
    <section class="backend-status-panel">
      <div class="backend-status-bar">
        <strong>Service Monitor</strong>
        <span class="backend-status-pill">Running</span>
      </div>
      <div class="backend-status-body">
        <pre class="backend-json">{
  <span class="json-key">"message"</span>: <span class="json-string">"Flask backend is running"</span>,
  <span class="json-key">"status"</span>: <span class="json-string">"ok"</span>,
  <span class="json-key">"port"</span>: <span class="json-string">"8306"</span>
}</pre>
        <div class="backend-ui-tip">
          Better presentation does not change the API response itself. It adds context around the response so the page feels like a dashboard instead of a raw endpoint dump.
        </div>
      </div>
    </section>

    <section class="backend-code-panel">
      <div class="backend-code-bar">
        <strong>Example Flask Setup</strong>
        <span>app.py</span>
      </div>
      <pre><code>from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
from dotenv import load_dotenv
import os

load_dotenv()
app = Flask(__name__)

try:
    import eventlet
    eventlet.monkey_patch()
    async_mode = "eventlet"
except ImportError:
    async_mode = "threading"

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode=async_mode,
    ping_timeout=60,
    ping_interval=25
)

app.config["FLASK_PORT"] = int(os.environ.get("FLASK_PORT") or 8306)
app.config["JSON_AS_ASCII"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or "SECRET_KEY"

db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager()
login_manager.init_app(app)</code></pre>
    </section>
  </div>
</section>

---

## 2. Tools We Will Use

- **Flask**: A simple Python web framework to create web servers and APIs  
- **Jinja2**: The template engine Flask uses to generate HTML pages dynamically  
- **Bootstrap**: A CSS framework to style pages easily and make them responsive  
- **HTML/CSS** basics for page layout and styling  

---


## 3. The Base Template (`base.html`)

This is the main layout shared by all pages.

### What it includes:

- Loading **Bootstrap CSS** and **JavaScript** for styling and components  
- Loading **Font Awesome** icons  
- Loading **jQuery** and **DataTables** for advanced table features  
- A **navbar** included from another file so it stays consistent  
- A cool animated background using Vanta.js (optional)

### How to use it:

---

## 6. Writing a Simple Flask App (`app.py`)

Here’s a minimal Flask app that serves our pages:

```python
from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html', project="Home")

@app.route('/users')
def users():
    # Example user data
    users_list = [
        {"id": 1, "name": "Alice", "email": "alice@example.com"},
        {"id": 2, "name": "Bob", "email": "bob@example.com"},
        {"id": 3, "name": "Carol", "email": "carol@example.com"},
    ]
    return render_template('users.html', project="Users", users=users_list)

if __name__ == "__main__":
    app.run(debug=True)
```
---
## 7. Creating Pages
Homepage (index.html)

---
## 8. Users Page (u2table.html)
This page shows a table of users.

---
## 9. Running Your App

1. Run the Flask app by pressing the **Play** button on `main.py`.
You should see output like:
Running on http://127.0.0.1:8587
2. Open your browser and go to [http://127.0.0.1:8587](http://127.0.0.1:8587) to see the homepage.

---
## 10. What Did We Learn?

- How to work with a base HTML template in a Flask app  
- How to use Jinja blocks to insert and customize page-specific content  
- How templates and static files are organized in a Flask project  
- How routes connect Flask backend to the templates and pass data  
- How to edit and improve an existing backend UI using tables and Bootstrap styles  
- How DataTables enhances tables with features like search and sorting
