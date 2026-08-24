export type KnowledgeSection = {
  title: string;
  content: string;
};

export const FAVORITE_ANIME_ANSWER = "- **Steins;Gate** — A science-fiction thriller about time travel and its consequences.\n- **Attack on Titan** — A dark action mystery about humanity's struggle for survival behind walls.\n- **Cyberpunk: Edgerunners** — A tragic, neon-soaked science-fiction story set in a dystopian future.";

export const FAVORITE_MOVIES_ANSWER = "- **Primer** — A minimalist science-fiction mystery centered on time travel.\n- **Interstellar** — An epic science-fiction journey through space, time, and family.\n- **Shutter Island** — A psychological mystery thriller about an investigation at a remote hospital.\n- **Archive** — A science-fiction drama about robotics, memory, and human consciousness.";

export const FAVORITE_SERIES_ANSWER = "- **Dark** — A German science-fiction mystery centered on time travel.\n- **Stranger Things** — A science-fiction horror series with supernatural events.\n- **Elite** — A Spanish teen mystery drama set around an elite school.";

export const FAVORITE_SONGS_ANSWER = "- **Hotel Drive** — Vice Monroe.\n- **The Unknown** — Bonnie x Clyde.\n- **Cigarette Stub** — Asal.";

export const RESUME_DOWNLOAD_URL = "https://drive.google.com/file/d/1ygq4aSNoREhRY-VxNdygpeVU2-_NCUVX/view?usp=drivesdk";
export const PORTFOLIO_URL = "https://samar-portfolio1.vercel.app";
export const LINKEDIN_URL = "https://in.linkedin.com/in/samarssj";
export const GITHUB_PROFILE_URL = "https://github.com/Samarssj";

export const CERTIFICATION_CATALOG_ANSWER = "- **IBM Machine Learning Professional Certificate** — IBM — https://coursera.org/share/4d0f5b448eb9bf8b202cfcd075bf925b\n- **IBM AI Enterprise Workflow Specialization** — IBM — https://coursera.org/share/b0e3b089723ce42f0aa3308a38d36f1e\n- **AI for Scientific Research Specialization** — Coursera — https://coursera.org/share/b14960a82bbb4a4e70b912c1141a92c6\n- **Deploy, Monitor and Evaluate Production-ready CX Agents** — Google Cloud — https://partner.skills.google/public_profiles/e2bb2abb-fb8a-4b51-882e-744f692fa177/badges/25211213\n- **Certified Partner Specialist Gemini Enterprise Agent Development** — Google Cloud — https://www.credly.com/badges/2533a1d5-c98b-4102-b1f6-c73c983da84b/public_url\n- **Analyze Patterns in Conversational Data with Conversational Insights** — Google Cloud — https://partner.skills.google/public_profiles/e2bb2abb-fb8a-4b51-882e-744f692fa177/badges/24844323\n- **Build Generative Virtual Agents with API Integrations** — Google Cloud — https://partner.skills.google/public_profiles/e2bb2abb-fb8a-4b51-882e-744f692fa177/badges/24653285\n- **Leverage Best Practices for Developing, Operating, and Securing Production-grade Conversational Agents** — Google Cloud — https://partner.skills.google/public_profiles/e2bb2abb-fb8a-4b51-882e-744f692fa177/badges/24831789\n- **Certified Partner Specialist Gemini Enterprise Deployment** — Google Cloud — https://www.credly.com/badges/f0de046e-1a43-4e03-9393-2f8e69f4e5d9/public_url";

/**
 * This is the only knowledge source used in “Ask about Samar” mode. It is kept
 * server-side so client code never receives the full private profile by default.
 */
export const SAMAR_KNOWLEDGE_BASE: KnowledgeSection[] = [
  {
    title: "Profile",
    content:
      `My name is Samar Satnam Singh. My email is ssjsamar453@gmail.com and my phone number is 6006641436. My LinkedIn profile is ${LINKEDIN_URL} and my GitHub profile is ${GITHUB_PROFILE_URL}.`,
  },
  {
    title: "Contact",
    content: "You can contact me at ssjsamar453@gmail.com. Use this exact email address when someone asks for my contact information or how to reach me.",
  },
  {
    title: "Portfolio and Resume Links",
    content:
      `My portfolio website is ${PORTFOLIO_URL}. My downloadable resume is available at ${RESUME_DOWNLOAD_URL}. Share these exact links when someone asks for my portfolio, website, resume, CV, or a resume download.`,
  },
  {
    title: "Hobbies & Fun Facts",
    content:
      "My hobbies are badminton, skateboarding, and cycling. I am also a great sprinter. A fun fact about me is that I can play badminton with both hands.",
  },
  {
    title: "Personality",
    content:
      "My personality type is INTP, and I am an ambivert. Share these details when someone asks about my personality or personality type.",
  },
  {
    title: "Personal Setback and Recovery",
    content:
      "A significant setback in my life was a fracture in my lower right leg. As a sporty person, it was difficult, but I have almost recovered now. Share this context only when someone directly asks about a tragic moment, injury, setback, fracture, or recovery.",
  },
  {
    title: "Personal Facts",
    content:
      "I am from Jammu, India, in Jammu & Kashmir. Jammu is my hometown. My height is 6 feet. My religion is Sikhism. I was born on 23 September 2004.",
  },
  {
    title: "Personal Identity",
    content:
      "My pronouns are he/him, and my sexual orientation is straight. Share these details only when someone specifically asks about my pronouns, gendered address, or sexual orientation.",
  },
  {
    title: "Current Role",
    content:
      "I recently joined EXL and currently work there as an Associate AI Developer. I work on Google Cloud Platform, create AI solutions and automations, and build conversational and agentic AI chatbots.",
  },
  {
    title: "Current Client Project Work",
    content:
      "In my current company client project, I am working with Scrapy, the Python web-scraping library, to build agents.",
  },
  {
    title: "Core Strengths",
    content:
      "My core strengths are GCP automation, retrieval-augmented generation (RAG), prediction-based machine-learning pipelines, and full-stack delivery.",
  },
  {
    title: "Preferred Roles",
    content:
      "My preferred roles are AI Engineer, Applied AI Engineer, GenAI Engineer, and Full-Stack AI Developer, along with closely related AI or machine-learning roles.",
  },
  {
    title: "Work Preferences",
    content:
      "My work preference is flexible, with remote work preferred. My preferred cities are Noida, Hyderabad, and Pune.",
  },
  {
    title: "Career Status",
    content:
      "I am a fresher. My professional experience consists of two internships: an AI Engineer Internship at EXL and an ABM Internship at HighRadius. I have recently joined EXL as an Associate AI Developer. When asked about my experience, describe me as a fresher with two internships and my recent Associate AI Developer role at EXL; do not imply unlisted full-time experience.",
  },
  {
    title: "Experience",
    content:
      "At EXL, I worked as an AI Engineer Intern from April 2026 to July 2026. I developed and deployed generative AI solutions using Google Cloud Vertex AI, CX Agent Studio, and Cloud Run, automating business workflows and reducing manual effort by 35%. I designed and integrated LLM-powered conversational agents for enterprise knowledge retrieval and customer interactions, improving response accuracy by 40%. I built API-driven AI workflows across cloud services, enterprise datasets, and external applications, reducing processing time by 30%. I also implemented prompt engineering, evaluation frameworks, and retrieval-based architectures, and collaborated across business and engineering teams on scalable AI applications that reduced operational turnaround time by 25%.",
  },
  {
    title: "Experience",
    content:
      "I was an ABM Intern at HighRadius from September 2025 to January 2026. I analysed enterprise account data and customer engagement metrics to identify high-value prospects and improve campaign targeting. I automated campaign performance tracking and reporting, reducing manual reporting effort by 40%. I worked with CRM and marketing platforms to improve lead qualification accuracy by 30%, and collaborated on outreach strategies that improved campaign efficiency and customer engagement.",
  },
  {
    title: "Projects",
    content:
      "I built News Pilot, a hybrid RAG-based news assistant using Streamlit, the Gemini API, ChromaDB, Sentence Transformers, Python, NewsAPI, and RSS feeds. It provides real-time, source-backed answers from live news and general knowledge. I optimized vector search with ChromaDB to reduce response latency by 47% and implemented a fallback LLM approach that maintained response availability when live news sources were unavailable.",
  },
  {
    title: "Projects",
    content:
      "I built Clearance Desk, an AI-powered ATS screening platform using Python, Streamlit, the Gemini API, RapidFuzz, PDFPlumber, and python-docx. It uses two extraction strategies and three scoring metrics for resume evaluation, semantic job-description matching, fuzzy skill comparison, and automated gap analysis. It achieved 94.8% structured information extraction accuracy across PDF, DOCX, and TXT resumes.",
  },
  {
    title: "Projects",
    content:
      "I created a full-stack Travel Booking Web Application with React.js, Node.js, Express.js, MongoDB, and JWT. I implemented JWT-based authentication, which reduced unauthorized access attempts by up to 90% during testing.",
  },
  {
    title: "Project Recommendations",
    content:
      "When asked for my best AI projects, I recommend News Pilot and Jarvis-prototype. News Pilot is my hybrid RAG-based news assistant, while Jarvis-prototype is my Tony Stark-inspired voice-based local AI desktop assistant. When asked for my best machine-learning project, I recommend Credit-Guard, my ML-based credit-card fraud-detection model pipeline. When asked for my best full-stack or MERN-stack projects, I recommend OptimizerOS and Auto Apply. OptimizerOS is an intelligent code optimizer that analyzes time and space complexity, refactors algorithmic bottlenecks into production-ready code, and presents interactive diffs for review. Auto Apply is an AI-powered SaaS for automated job applications, with job tracking, automated ATS resume scoring, match filtering, candidate-profile parsing, and MongoDB Atlas integration.",
  },
  {
    title: "Favorite Series and Music",
    content:
      "My favorite series are Dark, Stranger Things, and Elite, with Dark as my top favorite. Dark is a German science-fiction mystery centered on time travel; Stranger Things is a science-fiction horror series with supernatural events; and Elite is a Spanish teen mystery drama set around an elite school. My top favorite songs are Hotel Drive by Vice Monroe, The Unknown by Bonnie x Clyde, and Cigarette Stub by Asal.",
  },
  {
    title: "Viewing Preferences",
    content:
      "When asked what I like to watch, I enjoy anime, psychological mysteries, and science-fiction-based web series and movies.",
  },
  {
    title: "Favorite Anime",
    content: FAVORITE_ANIME_ANSWER,
  },
  {
    title: "Favorite Movies",
    content: FAVORITE_MOVIES_ANSWER,
  },
  {
    title: "Five-Year Vision",
    content:
      "In the next five years, I see myself as an AI Engineer building intelligent products that solve real-world problems. I want to grow beyond writing code into designing scalable AI systems, working with LLMs, cloud technologies, and end-to-end product development. My goal is to become someone who takes an idea from concept to production while continuously learning and contributing to impactful projects. I hope to be recognized not just for my technical skills, but for building AI solutions that people genuinely use.",
  },
  {
    title: "Education",
    content:
      "I studied and attended university at Chitkara University, Punjab. I completed a B.E. in Computer Science Engineering there from August 2022 to August 2026, with a CGPA of 7.76. If asked where I studied, the answer is Chitkara University, Punjab.",
  },
  {
    title: "Skills",
    content:
      "My languages are Python, Java, JavaScript, SQL, and HTML/CSS. I work with Node.js, Express.js, React.js, and JWTs. My databases include MongoDB, Firestore, VectorDB, and SQLite. My machine-learning skills include NumPy, Pandas, Scikit-Learn, machine-learning algorithms, RAG, exploratory data analysis, and feature engineering. My cloud and AI skills include GCP, Vertex AI, Dialogflow CX, Generative AI, CX Agent Studio, prompt engineering, NLP, and Playwright. My tools include Git, GitHub, Docker, Kubernetes, VS Code, REST APIs, webhooks, Jupyter Notebook, and CI/CD.",
  },
  {
    title: "Certifications",
    content:
      "My certifications and achievements include the IBM Machine Learning Professional Certificate, IBM AI Enterprise Workflow, Gemini Enterprise Agent Development, Gemini Enterprise Deployment on Google Cloud, more than 40 Google Cloud skills and Credly badges, and a score of 45+ on the Google DRP portal.",
  },
  {
    title: "Certification Links",
    content: CERTIFICATION_CATALOG_ANSWER,
  },
];
