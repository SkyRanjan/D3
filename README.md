# UST AI Virtual Representative

An AI-powered virtual corporate representative for **UST** designed for professional visitor interaction at a corporate reception.

The application combines a visitor-specific profile, UST knowledge, conversation memory, decision-driven context selection, an LLM response layer, and response validation to produce personalized and controlled conversations.

---

## Features

- Professional AI representative for UST visitors
- Visitor-specific context and personalization
- UST knowledge grounding
- Current-session conversation memory
- Previous-session conversation memory
- Decision layer for:
  - `ANSWER`
  - `CLARIFY`
  - `REFUSE`
  - `ESCALATE`
- Decision-driven Context-Augmented Generation (D-CAG)
- Structured decision output using Pydantic
- Response validation and basic confidentiality guardrails
- FastAPI backend
- Next.js frontend
- Hugging Face inference for LLMs
- Persistent local session and visitor records

---

## System Architecture

```text
                    ┌──────────────────────┐
                    │    Visitor / User    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Next.js Frontend  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     FastAPI Backend  │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
          Decision Layer   Session Store   Visitor Store
                 │
                 ▼
              CAG Layer
                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
       UST    Visitor   Conversation
    Knowledge  Profile    History
        │        │        │
        └────────┼────────┘
                 ▼
             LLM Service
                 │
                 ▼
        Response Validator
                 │
                 ▼
             Final Reply
```

---

# 1. Prerequisites

Install the following before running the application.

### Required

- Git
- Python **3.10 or newer**
- Node.js **20 or newer**
- npm
- A Hugging Face account

The backend uses Hugging Face inference for the language models.

---

# 2. Clone the Repository

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_NAME>
```

The project should have the following structure:

```text
UST-AI-Representative/
│
├── backend/
│   ├── certs/
│   ├── knowledge/
│   │   └── ust_knowledge.md
│   ├── sessions/
│   ├── visitors/
│   ├── services/
│   │   ├── cagservice.py
│   │   ├── decisionservice.py
│   │   ├── llmservice.py
│   │   ├── responsevalidator.py
│   │   └── visitor_manager.py
│   ├── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# 3. Backend Setup

Open a terminal in the project root.

Move into the backend:

```bash
cd backend
```

## Create a virtual environment

### Windows

```powershell
python -m venv venv
```

Activate it:

```powershell
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks script execution, use:

```powershell
.\venv\Scripts\activate.bat
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

# 4. Install Backend Dependencies

With the virtual environment activated:

```bash
pip install -r requirements.txt
```

If `requirements.txt` is not present in your checkout, install the project's required Python packages according to the dependency file supplied with the project.

---

# 5. Hugging Face Authentication

The application uses Hugging Face inference.

Install the Hugging Face CLI if it is not already installed:

```bash
pip install -U huggingface_hub
```

Log in:

```bash
hf auth login
```

Follow the authentication instructions.

You do **not** need to place the Hugging Face token directly in the source code.

The application obtains the authenticated token through the Hugging Face client.

---

# 6. UST Knowledge Base

The representative uses:

```text
backend/knowledge/ust_knowledge.md
```

This file contains the approved UST information available to the representative.

Before deploying the application, make sure that this file contains only information that the representative is authorized to provide.

The LLM is instructed not to invent UST services, clients, projects, employees, capabilities, or other company information that is not present in the knowledge base.

---

# 7. Corporate Network / SSL Configuration

Most users will **not** need this step.

If you are running the application inside a corporate network that performs HTTPS inspection, such as a network using a corporate/Zscaler root certificate, Python may report an SSL certificate verification error when connecting to Hugging Face.

In that case, obtain the approved corporate root certificate from your organization's IT/security team and configure:

### Windows PowerShell

```powershell
setx SSL_CERT_FILE "C:\path\to\corporate-root-ca.cer"
setx REQUESTS_CA_BUNDLE "C:\path\to\corporate-root-ca.cer"
```

Restart the terminal after setting these variables.

**Do not disable SSL certificate verification.**

---

# 8. Start the Backend

From:

```text
project/backend/
```

run:

```powershell
uvicorn main:app --reload
```

The backend should start at:

```text
http://127.0.0.1:8000
```

Check the health endpoint by opening:

```text
http://127.0.0.1:8000/
```

Expected response:

```json
{
  "status": "ok",
  "message": "UST AI Virtual Representative backend is running"
}
```

FastAPI documentation is also available at:

```text
http://127.0.0.1:8000/docs
```

The Swagger interface can be used to test the backend endpoints.

---

# 9. Create a Visitor Profile

A visitor profile must exist before starting a visitor session.

The current backend exposes:

```text
POST /visitor/create
```

Example request:

```json
{
  "visitor_id": "visitor_001",
  "name": "John Doe",
  "organization": "ABC Corporation",
  "role": "Chief Technology Officer",
  "meeting_with": "UST Leadership Team",
  "purpose": "Discuss digital transformation opportunities",
  "areas_of_interest": [
    "Artificial Intelligence",
    "Cloud",
    "Data Analytics"
  ],
  "previous_context": "Previous discussions about digital transformation."
}
```

This creates a visitor profile under:

```text
backend/visitors/
```

The visitor profile is kept separate from the global UST knowledge base.

---

# 10. Start a Visitor Session

Use:

```text
POST /session/start
```

Request:

```json
{
  "visitor_id": "visitor_001"
}
```

The backend creates a session and returns a `session_id`.

Example:

```json
{
  "session_id": "visitor_001_20260924_103000",
  "visitor_id": "visitor_001",
  "status": "started"
}
```

The session is stored under:

```text
backend/sessions/
```

---

# 11. Start the Frontend

Open a **new terminal**.

From the project root:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The Next.js application will normally be available at:

```text
http://localhost:3000
```

Open that address in your browser.

---

# 12. Running the Complete Application

For a complete local run, use two terminals.

### Terminal 1 — Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

### Terminal 2 — Frontend

```powershell
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

# 13. Application Flow

The intended flow is:

```text
1. Authorized employee prepares visitor information
                         ↓
2. Visitor profile is created
                         ↓
3. Visitor session is started
                         ↓
4. Visitor interacts with the representative
                         ↓
5. Decision Layer analyzes the request
                         ↓
6. Required context is selected
                         ↓
7. LLM generates the response
                         ↓
8. Response Validator checks the response
                         ↓
9. Response is returned to the visitor
                         ↓
10. Conversation is stored in the session
```

---

# 14. Decision Layer

The decision layer does not generate the visitor's answer.

It determines how the application should handle a request.

### ANSWER

Used when the request can be answered using available context.

### CLARIFY

Used when the visitor's intent is genuinely ambiguous or insufficient.

### REFUSE

Used when the visitor requests confidential, private, restricted, or unauthorized information.

### ESCALATE

Used when a human UST representative is required, such as requests involving human authorization or actions the AI cannot perform.

---

# 15. Context Selection

The application can selectively use:

```text
UST_KNOWLEDGE
VISITOR_PROFILE
CURRENT_SESSION
PREVIOUS_SESSION
NONE
```

For example:

```text
"What services does UST provide?"
        ↓
UST_KNOWLEDGE
```

```text
"What is the purpose of my visit?"
        ↓
VISITOR_PROFILE
```

```text
"What did we discuss during my last visit?"
        ↓
PREVIOUS_SESSION
```

This prevents every request from automatically receiving every available piece of context.

---

# 16. Conversation Memory

Current conversations are stored as session records.

Example:

```text
backend/sessions/
└── visitor_001_20260924_103000.json
```

The session contains:

- visitor ID
- session ID
- start time
- end time
- conversation messages
- timestamps

Previous sessions can also be retrieved for the same visitor when the request explicitly requires previous-session context.

---

# 17. Visitor Data vs UST Knowledge

These are intentionally kept separate.

### Global UST Knowledge

```text
backend/knowledge/ust_knowledge.md
```

Contains stable, approved company information.

### Visitor Profile

```text
backend/visitors/<visitor_id>.json
```

Contains information specific to a visitor.

### Conversation Session

```text
backend/sessions/<session_id>.json
```

Contains the conversation for a particular visit.

Visitor information should **not** be permanently merged into the global UST knowledge base.

---

# 18. API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Backend health check |
| POST | `/visitor/create` | Create a visitor profile |
| POST | `/session/start` | Start a visitor session |
| POST | `/chat` | Send a visitor message |
| POST | `/session/end` | End the active session |

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

---

# 19. Testing the Backend Without the Frontend

The FastAPI Swagger UI can be used to test the application.

Open:

```text
http://127.0.0.1:8000/docs
```

Recommended order:

```text
1. /visitor/create
2. /session/start
3. /chat
4. /session/end
```

Example chat request:

```json
{
  "message": "What services does UST provide?"
}
```

Example conversational request:

```json
{
  "message": "What can you tell me about my meeting today?"
}
```

---

# 20. Important Security Notes

Do not commit the following to GitHub:

- Hugging Face tokens
- API keys
- passwords
- private keys
- corporate certificates
- confidential visitor information
- generated session data containing sensitive information

The repository should use `.gitignore` rules for local runtime data and credentials.

For example:

```gitignore
backend/venv/
backend/__pycache__/
backend/**/__pycache__/
*.pyc

.env
.env.*
!.env.example

backend/sessions/*.json
backend/visitors/*.json

frontend/node_modules/
frontend/.next/
frontend/out/

backend/certs/

.vscode/
.idea/
```

---

# 21. Production Considerations

The current project is designed to be easy to run and demonstrate locally.

Before production deployment, consider replacing local JSON persistence with a proper database and implementing:

- authenticated employee access
- role-based authorization
- secure visitor-profile management
- encrypted storage for sensitive information
- centralized session management
- audit logging
- production secret management
- rate limiting
- stronger response-grounding checks
- production monitoring
- scalable backend deployment

The current `current_session_id` approach is intended for the current prototype and should be replaced with proper session handling for multiple simultaneous visitors.

---

# 22. Troubleshooting

## `ModuleNotFoundError`

Make sure the backend virtual environment is activated:

```powershell
.\venv\Scripts\Activate.ps1
```

Then reinstall dependencies:

```powershell
pip install -r requirements.txt
```

---

## Hugging Face authentication error

Run:

```bash
hf auth login
```

Then verify that the CLI is authenticated.

---

## SSL certificate error

If you are on a corporate network, configure the approved corporate CA certificate as described in the SSL section above.

Do not disable certificate verification.

---

## Backend is running but frontend cannot connect

Verify that the backend is running:

```text
http://127.0.0.1:8000/
```

Then check that the frontend is configured to call the correct backend URL.

---

## Port 8000 already in use

Run the backend on another port:

```powershell
uvicorn main:app --reload --port 8001
```

Then update the frontend backend URL accordingly.

---

## Port 3000 already in use

Run Next.js on another port:

```bash
npm run dev -- -p 3001
```

Then open:

```text
http://localhost:3001
```

---

# 23. Technology Stack

### Frontend

- Next.js
- React
- JavaScript/TypeScript
- CSS

### Backend

- Python
- FastAPI
- Pydantic

### AI

- Large Language Models
- Meta Llama 3.1 8B Instruct
- GPT-OSS 120B for decision/orchestration
- Hugging Face Inference
- Decision-driven Context-Augmented Generation (D-CAG)
- Structured model output
- Prompt-based knowledge grounding

### Memory

- Visitor profiles
- Current-session conversation memory
- Previous-session memory

### Safety / Control

- Decision layer
- Response validation
- Confidentiality rules
- Knowledge grounding
- Human escalation

---

# 24. Quick Start

For experienced developers:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_NAME>

cd backend
python -m venv venv
```

### Windows

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
hf auth login
uvicorn main:app --reload
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Backend:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

---

## Project Purpose

The UST AI Virtual Representative demonstrates how an enterprise-focused conversational AI system can combine:

**Visitor Context + UST Knowledge + Conversation Memory + Decision Layer + Context Selection + LLM + Response Validation**

to provide a personalized and controlled corporate interaction experience.
