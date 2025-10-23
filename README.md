# AI Communication Coach

An interactive web application designed to help professionals master communication skills through AI-powered practice sessions. Users can select from various professional roles and engage in realistic workplace scenarios to improve their communication effectiveness.

## Features

- **Role-Based Training**: Choose from 10 professional roles including Developer, Data Analyst, Product Manager, UX Designer, Software Engineer, Data Scientist, Marketing Manager, Sales Representative, HR Specialist, and Project Manager
- **AI-Powered Feedback**: Receive instant feedback on your responses with scores, corrections, and improvement suggestions
- **Voice Input Support**: Use speech recognition to practice verbal communication skills
- **Progress Tracking**: Monitor your improvement with session progress and daily completion goals
- **Realistic Scenarios**: Practice with authentic workplace situations tailored to your role

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase Edge Functions, OpenAI API
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Supabase platform

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/NP0149/AI_Communication_Coach.git
cd AI_Communication_Coach
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory and add your environment variables:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up Supabase:
   - Create a new Supabase project
   - Run the migration file: `supabase/migrations/20251021175946_create_communication_training_schema.sql`
   - Deploy the Edge Function: `supabase/functions/ai-communication-coach/index.ts`
   - Add your OpenAI API key to the Edge Function environment variables

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to `http://localhost:5174`

3. Select a professional role to begin practicing

4. Engage with AI-generated scenarios and receive feedback on your responses

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the project for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint for code quality checks
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
project/
├── src/
│   ├── lib/
│   │   └── supabase.ts          # Supabase client configuration
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # Application entry point
│   ├── index.css                # Global styles
│   └── vite-env.d.ts            # Vite environment types
├── supabase/
│   ├── functions/
│   │   └── ai-communication-coach/
│   │       └── index.ts         # Edge Function for AI coaching
│   └── migrations/
│       └── 20251021175946_create_communication_training_schema.sql
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Database Schema

The application uses the following main tables:
- `sessions` - Stores user practice sessions
- `messages` - Stores conversation messages between user and AI

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React, TypeScript, and Tailwind CSS
- Powered by Supabase and OpenAI
- Icons provided by Lucide React
