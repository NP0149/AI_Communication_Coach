import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  developer: "You are an AI coach helping a software developer practice professional communication. Provide realistic workplace scenarios and evaluate their responses for clarity, technical accuracy, and professionalism.",
  "data-analyst": "You are an AI coach helping a data analyst practice professional communication. Provide realistic scenarios involving data interpretation and stakeholder communication.",
  "product-manager": "You are an AI coach helping a product manager practice professional communication. Provide scenarios involving cross-functional collaboration and strategic decision-making.",
  "ux-designer": "You are an AI coach helping a UX designer practice professional communication. Provide scenarios involving design critique and user research presentation.",
  "software-engineer": "You are an AI coach helping a software engineer practice professional communication. Provide scenarios involving technical discussions and code reviews.",
  "data-scientist": "You are an AI coach helping a data scientist practice professional communication. Provide scenarios involving model explanations and data-driven recommendations.",
  "marketing-manager": "You are an AI coach helping a marketing manager practice professional communication. Provide scenarios involving campaign planning and stakeholder presentations.",
  "sales-representative": "You are an AI coach helping a sales representative practice professional communication. Provide scenarios involving client interactions and objection handling.",
  "hr-specialist": "You are an AI coach helping an HR specialist practice professional communication. Provide scenarios involving employee relations and policy communication.",
  "project-manager": "You are an AI coach helping a project manager practice professional communication. Provide scenarios involving team coordination and status updates.",
};

const SCENARIOS: Record<string, string[]> = {
  developer: [
    "Your team lead asks you to explain why a feature is taking longer than estimated. How do you respond?",
    "A non-technical stakeholder asks you to explain a complex bug. How do you communicate this?",
    "You need to push back on a tight deadline. How do you approach this conversation?",
  ],
  "data-analyst": [
    "Present your analysis findings that contradict the executive team's assumptions.",
    "Explain data quality issues affecting a critical business report.",
    "A stakeholder wants you to manipulate data to support their narrative. How do you respond?",
  ],
  "product-manager": [
    "Two teams disagree on feature priorities. How do you facilitate this discussion?",
    "Marketing wants a feature that engineering says is technically complex. How do you mediate?",
    "Present a product pivot decision to resistant stakeholders.",
  ],
  "ux-designer": [
    "Present user research findings that challenge the CEO's product vision.",
    "A developer says your design is too complex to implement. How do you respond?",
    "Defend your design decisions during a critique session.",
  ],
  "software-engineer": [
    "Explain technical debt to non-technical managers requesting new features.",
    "Your code review feedback was misunderstood as criticism. How do you clarify?",
    "Propose a major architectural change to the team.",
  ],
  "data-scientist": [
    "Explain why your ML model's accuracy dropped in production.",
    "Business wants faster results but you need more time for validation. How do you respond?",
    "Present the limitations of your predictive model to eager stakeholders.",
  ],
  "marketing-manager": [
    "Your campaign underperformed. Present results and next steps to leadership.",
    "Sales team wants more leads but you need more budget. How do you negotiate?",
    "Explain why a viral marketing idea won't work for the brand.",
  ],
  "sales-representative": [
    "A client is upset about delayed delivery. How do you handle this conversation?",
    "Present pricing to a cost-conscious prospect.",
    "A competitor is offering a lower price. How do you respond?",
  ],
  "hr-specialist": [
    "An employee complains about unfair treatment. How do you investigate sensitively?",
    "Communicate a unpopular policy change to the company.",
    "Mediate a conflict between two team members.",
  ],
  "project-manager": [
    "The project is behind schedule. Update stakeholders on the situation.",
    "A team member is underperforming. How do you address this?",
    "Scope creep is threatening the deadline. How do you communicate boundaries?",
  ],
};

interface RequestBody {
  role: string;
  userMessage?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  messageCount?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { role, userMessage, conversationHistory = [], messageCount = 0 }: RequestBody = await req.json();

    if (!role || !SYSTEM_PROMPTS[role]) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!userMessage) {
      const scenarios = SCENARIOS[role] || [];
      const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];

      return new Response(
        JSON.stringify({
          message: `Welcome! Let's practice professional communication for your role as a ${role.replace(/-/g, ' ')}. Here's your scenario:\n\n${randomScenario}\n\nPlease respond as you would in a real workplace situation.`,
          scenario: randomScenario,
          isScenario: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use OpenAI to analyze the user's response
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    const systemPrompt = SYSTEM_PROMPTS[role];
    const scenario = conversationHistory.length > 0 ? conversationHistory[0].content : "General workplace communication scenario";

    const analysisPrompt = `
You are an AI communication coach. Analyze the user's response to the following scenario and provide constructive feedback.

Role: ${role.replace(/-/g, ' ')}
Scenario: ${scenario}
User's Response: "${userMessage}"

Please provide:
1. A corrected version of the user's response with any grammatical mistakes fixed
2. A score from 1-100 based on professionalism, clarity, and effectiveness
3. Specific feedback on what was good and what could be improved
4. A follow-up question or scenario to continue the practice

Keep your response concise but helpful. Format as JSON with keys: correctedResponse, score, feedback, nextMessage
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: analysisPrompt }
      ],
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;
    let analysis;

    try {
      analysis = JSON.parse(aiResponse);
    } catch (e) {
      // Fallback if JSON parsing fails
      analysis = {
        correctedResponse: userMessage, // No correction if AI fails
        score: calculateScore(userMessage),
        feedback: generateFeedback(userMessage, calculateScore(userMessage)),
        nextMessage: generateFollowUp(role, userMessage, conversationHistory)
      };
    }

    return new Response(
      JSON.stringify({
        message: analysis.nextMessage || generateFollowUp(role, userMessage, conversationHistory),
        feedback: analysis.feedback,
        score: analysis.score,
        correctedResponse: analysis.correctedResponse,
        isComplete: messageCount >= 9,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function calculateScore(message: string): number {
  let score = 50;
  
  if (message.length > 100) score += 10;
  if (message.length > 200) score += 10;
  
  const professionalWords = ['however', 'therefore', 'additionally', 'furthermore', 'regarding', 'concerning'];
  professionalWords.forEach(word => {
    if (message.toLowerCase().includes(word)) score += 5;
  });
  
  if (/[.!?]/.test(message)) score += 5;
  if (message.split(/[.!?]/).length > 2) score += 5;
  
  const hasStructure = message.includes('First') || message.includes('Second') || message.includes('Additionally');
  if (hasStructure) score += 10;
  
  return Math.min(score, 100);
}

function generateFeedback(message: string, score: number): string {
  const feedbackParts = [];
  
  if (score >= 80) {
    feedbackParts.push("Excellent response! Your communication is clear and professional.");
  } else if (score >= 60) {
    feedbackParts.push("Good response! Consider adding more detail to strengthen your message.");
  } else {
    feedbackParts.push("Your response could be improved. Try to be more detailed and structured.");
  }
  
  if (message.length < 100) {
    feedbackParts.push("Consider providing more context and detail in your responses.");
  }
  
  const hasProfessionalTone = /\b(however|therefore|regarding)\b/i.test(message);
  if (!hasProfessionalTone) {
    feedbackParts.push("Try using more professional language and transitional phrases.");
  }
  
  return feedbackParts.join(" ");
}



function generateFollowUp(role: string, userMessage: string, history: Array<{ role: string; content: string }>): string {
  const followUps = [
    "That's a good start. How would you handle pushback from stakeholders on this approach?",
    "Interesting perspective. Can you elaborate on the specific steps you would take?",
    "I appreciate your thoughtful response. What would you do if the situation escalated?",
    "Good communication! How would you adjust your message for a different audience?",
    "Well articulated. What metrics or evidence would you use to support your position?",
    "Thank you for that detailed response. How would you follow up after this conversation?",
    "Strong answer. What potential objections might you face and how would you address them?",
    "Nice work! How would you document this discussion for future reference?",
    "Good thinking. What timeline would you propose for implementing this solution?",
  ];

  const randomIndex = Math.min(history.length / 2, followUps.length - 1);
  return followUps[Math.floor(randomIndex)];
}
