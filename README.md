# Generative: AI-Powered Educational Media & Interactive Learning Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.1.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Convex](https://img.shields.io/badge/Convex-1.31.6-FF4500?style=flat-square)](https://convex.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.0-38BDF8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Generative** is a state-of-the-art educational application designed to transform raw study materials—text prompts, PDFs, and Word documents—into dynamic educational video summaries, structured study notes, interactive flashcard decks, and personalized voice clones.

By bridging modern artificial intelligence models with real-time reactive infrastructure, **Generative** makes complex learning materials engaging, accessible, and interactive for students and self-learners alike.

---

## 🌟 Key Features

- **⚡ Instant AI Video Summaries**: Convert lengthy documents, raw text, or topic prompts into engaging visual video scripts and synthesized video presentations.
- **🎴 Interactive Flashcard Decks**: Automatically extract key concepts, terms, and definitions into interactive flashcard study decks with mastery score tracking.
- **📝 Structured Note Synthesis**: Generate clean, hierarchical study notes and summaries from uploaded files or generated videos.
- **👤 Guest & Hybrid User Sessions**: Seamlessly try out generation capabilities as a guest powered by `@fingerprintjs/fingerprintjs` or sign in with Clerk for persistent history across devices.
- **⚡ Realtime State Synchronization**: Built on Convex backend architecture, providing live data updates for generation progress, subscriptions, and study metrics.
- **💳 Tiered Subscriptions & Payments**: Integrated with Dodo Payments (`@dodopayments/convex`) for secure subscription management and feature access tiers.
- **📥 Media Vault & Export Engine**: Save, organize, filter, and download your generated study assets and video summaries directly to your device.

---

## 🛠️ Tech Stack & Architecture

### **Core Technologies**
- **Frontend Framework**: Next.js 16.1 (App Router), React 19.2
- **Language**: TypeScript 5.x
- **Backend & Database**: Convex (Realtime Document Database, Serverless Functions, File Storage)
- **Authentication**: Clerk (`@clerk/nextjs`) integrated with Convex Web Tokens
- **Payment Gateway**: Dodo Payments (`@dodopayments/convex`)
- **Styling & UI**: Tailwind CSS v4, Motion (Animations), Shadcn UI, Sonner (Notifications)
- **Document Processing**: `mammoth` (Word `.docx` parsing), `unpdf` (PDF text extraction)
- **Guest Identification**: FingerprintJS (`@fingerprintjs/fingerprintjs`)
- **State Management**: Zustand & Custom React Hooks

---

### **Folder Tree Structure**

```
generative/
├── app/                        # Next.js App Router (Pages, Layouts, API Routes)
│   ├── api/                    # Serverless API routes
│   │   ├── download/           # Media & export handling route
│   │   ├── generate/           # Guest video & content generation endpoint
│   │   ├── generate-auth/      # Authenticated user video generation endpoint
│   │   └── pricing/            # Payment gateway checkout & webhook setup
│   ├── page.tsx                # Main Landing Page & Content Generation Workspace
│   ├── videovault/             # Personal study library (Saved videos, notes, flashcards)
│   └── watch/[id]/             # Interactive video viewer, flashcard deck, & quiz hub
├── components/                 # React UI Components
│   ├── ui/                     # Shadcn UI primitives (Buttons, Dialogs, Cards, Inputs)
│   ├── Navbar.tsx              # Top navigation, theme toggle, and Clerk user button
│   ├── VideoPlayer.tsx         # Media stream playback controller
│   ├── FlashcardViewer.tsx     # Interactive flashcard deck flip/study component
│   ├── NoteViewer.tsx          # Markdown/formatted study notes view
│   └── PaywallModal.tsx        # Dodo Payments checkout modal dialog
├── convex/                     # Convex Backend Architecture
│   ├── schema.ts               # Database table schemas (videos, flashcards, notes, users)
│   ├── auth.config.ts          # Clerk authentication provider configuration
│   ├── http.ts                 # Webhook router (Payment notifications)
│   ├── videos.ts               # Video query & mutation functions
│   ├── flashcards.ts           # Flashcard generation, review, and mastery queries
│   ├── notes.ts                # Study note creation and retrieval functions
│   ├── guest.ts                # Fingerprint-based guest session logic & limits
│   ├── subscriptions.ts        # Subscription tiers and feature access controls
│   └── userPreferences.ts      # User custom settings and preferences
├── hooks/                      # Custom React hooks (useGuestId, useUser, etc.)
├── lib/                        # Helper utilities and document parsing scripts
├── providers/                  # Application context providers (ConvexClientProvider)
└── public/                     # Static graphics, icons, and media samples
```

---

## 📋 Prerequisites & Requirements

Before setting up the project, ensure you have the following installed on your local machine:

- **Node.js**: `v18.17.0` or higher (recommended: `v20.x`)
- **Package Manager**: `npm` (v9+), `pnpm` (v8+), or `bun` (v1.x)
- **Accounts**:
  - [Convex Cloud Account](https://www.convex.dev/) (For backend functions and database)
  - [Clerk Account](https://clerk.com/) (For user authentication)
  - [Dodo Payments Account](https://dodopayments.com/) *(Optional: for payment processing)*

---

## 🚀 Installation & Setup

### **1. Clone the Repository**

```bash
git clone https://github.com/Pirate193/generative.git
cd generative
```

### **2. Install Dependencies**

Using `npm`:
```bash
npm install
```

Or using `bun`:
```bash
bun install
```

---

### **3. Environment Variables Configuration**

Create a `.env.local` file in the root directory:

```env
# Convex Backend Deployment URL
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud

# Clerk Authentication Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER_URL=https://your-clerk-instance.clerk.accounts.dev

# Dodo Payments (Optional for billing testing)
DODO_PAYMENTS_API_KEY=your_dodo_api_key
DODO_PAYMENTS_WEBHOOK_SECRET=your_dodo_webhook_secret
```

---

### **4. Initialize & Run Convex Backend**

In your project terminal, log into Convex and start the real-time development server:

```bash
npx convex dev
```

*This command will set up your Convex project deployment and sync the functions in `convex/` with your cloud environment.*

---

### **5. Start the Next.js Development Server**

In a separate terminal window, start the frontend development server:

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser to view the application.

---

## 💻 Usage Examples

### **1. Triggering Video Generation from a React Component**

```tsx
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function ContentGenerator() {
  const [topic, setTopic] = useState("");
  const createVideo = useMutation(api.videos.createvideo);

  const handleGenerate = async () => {
    const videoId = await createVideo({
      title: topic,
      prompt: topic,
      status: "processing",
    });
    console.log("Created video draft ID:", videoId);
  };

  return (
    <div className="flex gap-2">
      <input 
        type="text" 
        value={topic} 
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Enter a topic or paste text..."
        className="px-4 py-2 border rounded-md"
      />
      <button onClick={handleGenerate} className="px-4 py-2 bg-blue-600 text-white rounded-md">
        Generate Study Material
      </button>
    </div>
  );
}
```

---

### **2. Fetching User Videos & Flashcards with Convex React Hooks**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function UserStudyLibrary() {
  const videos = useQuery(api.videos.getusersvideo);

  if (videos === undefined) return <p>Loading your study vault...</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {videos.map((video) => (
        <div key={video._id} className="p-4 border rounded-lg shadow-sm">
          <h3 className="font-bold text-lg">{video.title}</h3>
          <span className="text-sm text-gray-500">Status: {video.status}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 📡 API / Endpoint Reference

### **Next.js Serverless Routes**

#### `POST /api/generate`
Generates educational video script and study assets for guest users.

- **Request Body**:
  ```json
  {
    "prompt": "Explain the process of photosynthesis",
    "guestId": "fp_8a92b3c4d5e6f",
    "documentText": "Optional document text excerpt..."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "videoId": "jx71a9v8c0b2d4e",
    "status": "processing"
  }
  ```

---

#### `POST /api/generate-auth`
Generates educational video content for authenticated user accounts.

- **Headers**: `Authorization: Bearer <clerk_session_token>`
- **Request Body**:
  ```json
  {
    "prompt": "Quantum Computing Fundamentals",
    "documentText": "Full parsed PDF text..."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "videoId": "k91bc8d7f6e5a4b",
    "status": "processing"
  }
  ```

---

#### `POST /api/download`
Prepares exportable file links for video summaries and study notes.

- **Request Body**:
  ```json
  {
    "videoId": "k91bc8d7f6e5a4b",
    "format": "mp4"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "downloadUrl": "https://storage.convex.cloud/..."
  }
  ```

---

### **Convex Realtime Functions (`convex/`)**

| Function Path | Type | Description |
| :--- | :--- | :--- |
| `api.videos.getusersvideo` | Query | Retrieves videos owned by the authenticated user |
| `api.videos.getpublicvideos` | Query | Retrieves showcase videos for the public gallery |
| `api.guest.getguestvideo` | Query | Fetches videos created in a specific guest session |
| `api.flashcards.getflashcardsbyvideoid` | Query | Loads interactive flashcard deck for a video |
| `api.notes.getnotesbyvideoid` | Query | Loads synthesized study notes for a video |
| `api.subscriptions.getusersubscription` | Query | Fetches user plan limits and active subscription status |

---

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please follow these steps:

1. **Fork** the repository.
2. **Create** a new feature branch (`git checkout -b feature/amazing-feature`).
3. **Commit** your changes (`git commit -m 'Add amazing feature'`).
4. **Push** to the branch (`git push origin feature/amazing-feature`).
5. **Open** a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p center align="center">Made with ❤️ for Hack for Humanity</p>
