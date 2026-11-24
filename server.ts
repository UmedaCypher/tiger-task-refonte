import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");

app.use(express.json());

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Create initial empty files if they don't exist
    const usersFile = path.join(DATA_DIR, "users.json");
    const tasksFile = path.join(DATA_DIR, "tasks.json");
    
    try {
      await fs.access(usersFile);
    } catch {
      await fs.writeFile(usersFile, JSON.stringify([], null, 2));
    }
    
    try {
      await fs.access(tasksFile);
    } catch {
      await fs.writeFile(tasksFile, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error("Error creating data directory:", error);
  }
}

// Helpers for file database
async function readUsers() {
  const file = path.join(DATA_DIR, "users.json");
  const data = await fs.readFile(file, "utf-8");
  return JSON.parse(data);
}

async function writeUsers(users: any[]) {
  const file = path.join(DATA_DIR, "users.json");
  await fs.writeFile(file, JSON.stringify(users, null, 2));
}

async function readTasks() {
  const file = path.join(DATA_DIR, "tasks.json");
  const data = await fs.readFile(file, "utf-8");
  return JSON.parse(data);
}

async function writeTasks(tasks: any[]) {
  const file = path.join(DATA_DIR, "tasks.json");
  await fs.writeFile(file, JSON.stringify(tasks, null, 2));
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Simulated and Real Email Helper functions
async function readEmails() {
  const emailsFile = path.join(DATA_DIR, "emails.json");
  try {
    const data = await fs.readFile(emailsFile, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeEmails(emails: any[]) {
  const emailsFile = path.join(DATA_DIR, "emails.json");
  await fs.writeFile(emailsFile, JSON.stringify(emails, null, 2));
}

async function sendConfirmationEmail(toEmail: string, subject: string, htmlContent: string) {
  const emails = await readEmails();
  const newEmail = {
    id: crypto.randomUUID(),
    to: toEmail,
    subject,
    html: htmlContent,
    sentAt: new Date().toISOString()
  };
  emails.unshift(newEmail); // Add to top of list
  await writeEmails(emails);

  console.log(`[Email Sent] To: ${toEmail} | Subject: ${subject}`);

  // If BREVO_API_KEY is configured, send real email via Brevo
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    try {
      console.log(`[Brevo] Sending real email to ${toEmail}...`);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: "Tiger Task 🐅",
            email: "contact@tigertask.com"
          },
          to: [
            {
              email: toEmail
            }
          ],
          subject: subject,
          htmlContent: htmlContent
        })
      });
      if (response.ok) {
        console.log(`[Brevo Success] Real email sent to ${toEmail}`);
      } else {
        const errText = await response.text();
        console.warn(`[Brevo Warn] Failed to send real email: ${errText}`);
      }
    } catch (err) {
      console.error("[Brevo Error] Failed to send real email:", err);
    }
  }

  // If RESEND_API_KEY is configured, send real email via Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/v1/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Tiger Task <onboarding@resend.dev>",
          to: toEmail,
          subject: subject,
          html: htmlContent
        })
      });
      if (response.ok) {
        console.log(`[Resend Success] Real email sent to ${toEmail}`);
      } else {
        const errText = await response.text();
        console.warn(`[Resend Warn] Failed to send real email: ${errText}`);
      }
    } catch (err) {
      console.error("[Resend Error] Failed to send real email:", err);
    }
  }
}

// Ensure target user accounts are premium, verified, and their tasks are cleared for a clean slate
async function cleanupUserAccounts() {
  try {
    const users = await readUsers();
    const tasks = await readTasks();
    let updated = false;
    
    // Find target users
    const targetUsers = users.filter((u: any) => 
      (u.username && u.username.toLowerCase() === "quentinmahe") ||
      (u.email && u.email.toLowerCase() === "quentin.mahe@asklocala.com") ||
      (u.email && u.email.toLowerCase() === "cliquequentinok@hotmail.fr")
    );
    
    for (const targetUser of targetUsers) {
      console.log(`[Startup] Ensuring user ${targetUser.username} (${targetUser.email}) is verified, premium and clean.`);
      
      // Enforce premium and verified status
      targetUser.isPremium = true;
      targetUser.premiumPlan = 'yearly';
      targetUser.isVerified = true;
      updated = true;
      
      // Delete all tasks for this user ID
      const targetUserId = targetUser.id;
      const initialTaskCount = tasks.length;
      const filteredTasks = tasks.filter((t: any) => t.userId !== targetUserId);
      if (initialTaskCount !== filteredTasks.length) {
        console.log(`[Startup] Deleted ${initialTaskCount - filteredTasks.length} tasks for user ${targetUser.username}`);
        // Mutate tasks array in place or reassign
        tasks.length = 0;
        tasks.push(...filteredTasks);
      }
    }

    if (updated) {
      await writeUsers(users);
      await writeTasks(tasks);
    } else {
      console.log("[Startup] Target users not found yet. They will be premium/verified instantly upon creation.");
    }
  } catch (err) {
    console.error("Error in cleanupUserAccounts:", err);
  }
}


// Standard Fibre Tigre seeded tasks
const FIBRE_TIGRE_SEED_DATA = [
  { text: "Save Google", status: "green", priority: 8 },
  { text: "Récap Sam Aria ?", status: "green", priority: 6 },
  { text: "12 ok Iah JDR ?", status: "green", priority: 5 },
  { text: "Récap Sam dates Team Magic / Space", status: "green", priority: 7 },
  { text: "Homa ok le 10 ?", status: "green", priority: 4 },
  { text: "Nouveau classeur compta", status: "green", priority: 9 },
  { text: "Schéma P", status: "green", priority: 6 },
  { text: "Space GoR", status: "green", priority: 5 },
  { text: "Dossier CAs Postales", status: "green", priority: 7 },
  { text: "Réseaux Sociaux / CM Sigma", status: "green", priority: 4 },
  { text: "manuel game design", status: "green", priority: 7 },
  { text: "Nouveau Excel", status: "green", priority: 8 },
  { text: "Vélo", status: "green", priority: 3 },
  { text: "Point ancien excel", status: "yellow", priority: 6 },
  { text: "Google Download", status: "red", priority: 9 },
  { text: "Aspirateur", status: "green", priority: 2 },
  { text: "Suivi livre hlabrande", status: "yellow", priority: 7 },
  { text: "Podcast Transformice", status: "blue", priority: 8 },
  { text: "TBW : Dowerin", status: "purple", priority: 5 },
  { text: "Échec cuisant de négo", status: "black", priority: 9 }
];

// Helper to get relative dates from today
function getSeededTasksForNewUser(userId: string) {
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const tasks: any[] = [];
  
  // Seed yesterday's tasks (mostly done, some postponed)
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Save Google",
    status: "green",
    priority: 8,
    date: yesterdayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Nouveau classeur compta",
    status: "green",
    priority: 9,
    date: yesterdayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Podcast Transformice",
    status: "blue", // récurrente finie
    priority: 7,
    date: yesterdayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Faire les courses de la semaine",
    status: "yellow", // reporté flemme
    priority: 4,
    date: yesterdayStr,
    createdAt: new Date().toISOString()
  });

  // Seed today's tasks (some done, some white/todo)
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Faire les courses de la semaine (depuis hier)",
    status: "white", // à faire (cloné du report de flemme d'hier)
    priority: 5,
    date: todayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Aspirateur & Ménage",
    status: "green",
    priority: 2,
    date: todayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "manuel game design",
    status: "white",
    priority: 8,
    date: todayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Space GoR : écriture scénario",
    status: "white",
    priority: 6,
    date: todayStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Factures Pippa & Compta",
    status: "purple", // reporté independamment
    priority: 7,
    date: todayStr,
    createdAt: new Date().toISOString()
  });

  // Seed tomorrow's tasks (todo)
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Factures Pippa & Compta (depuis hier)",
    status: "white", // cloné automatiquement
    priority: 7,
    date: tomorrowStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "RDV médecin toulon",
    status: "white",
    priority: 9,
    date: tomorrowStr,
    createdAt: new Date().toISOString()
  });
  tasks.push({
    id: crypto.randomUUID(),
    userId,
    text: "Vélo d'entraînement",
    status: "white",
    priority: 3,
    date: tomorrowStr,
    createdAt: new Date().toISOString()
  });

  return tasks;
}

function getCurrentWeekDateStrings(): string[] {
  const today = new Date();
  const day = today.getDay();
  // Standard French/European starting on Monday
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    weekDates.push(`${yyyy}-${mm}-${dd}`);
  }
  return weekDates;
}

// Authentication Middleware
async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentification requise" });
  }

  try {
    const users = await readUsers();
    const user = users.find((u: any) => u.token === token);
    
    if (!user) {
      return res.status(403).json({ error: "Session expirée ou invalide" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur d'authentification" });
  }
}

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/* ==========================================================================
   AUTH ENDPOINTS
   ========================================================================== */

app.post("/api/auth/register", async (req, res) => {
  const { username, password, email } = req.body;
  const displayName = req.body.displayName || username;

  if (!username || !password || !email) {
    return res.status(400).json({ error: "Veuillez remplir tous les champs, y compris l'adresse email" });
  }

  // Password strength check
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ 
      error: "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre." 
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "L'adresse email n'est pas valide" });
  }

  try {
    const users = await readUsers();
    
    if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: "Ce nom d'utilisateur est déjà pris" });
    }

    if (users.some((u: any) => u.email && u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: "Cette adresse email est déjà associée à un compte" });
    }

    const lowerUsername = username.toLowerCase();
    const lowerEmail = email.toLowerCase();
    const isPremium = lowerUsername === "fibretigre" || lowerUsername === "demo" || lowerUsername === "quentinmahe" || lowerEmail === "quentin.mahe@asklocala.com" || lowerEmail === "cliquequentinok@hotmail.fr";
    const premiumPlan = isPremium ? "yearly" : null;
    const isVerified = (lowerUsername === "quentinmahe" || lowerEmail === "quentin.mahe@asklocala.com" || lowerEmail === "cliquequentinok@hotmail.fr") ? true : false;

    const token = crypto.randomBytes(32).toString("hex");
    const newUser = {
      id: crypto.randomUUID(),
      username,
      displayName,
      email,
      passwordHash: hashPassword(password),
      token,
      isPremium,
      premiumPlan,
      isVerified,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users);

    // Seed realistic Fibre Tigre data only for demo or fibretigre usernames
    if (lowerUsername === "fibretigre" || lowerUsername === "demo") {
      const seededTasks = getSeededTasksForNewUser(newUser.id);
      const allTasks = await readTasks();
      allTasks.push(...seededTasks);
      await writeTasks(allTasks);
    }

    // Trigger onboarding confirmation email
    const appUrl = process.env.APP_URL || "https://ais-pre-evkx7o4lzas5x7tzcywqim-959502944243.europe-west2.run.app";
    const verifyUrl = `${appUrl}/api/auth/verify?email=${encodeURIComponent(email)}`;
    const welcomeHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #020617; color: #f1f5f9; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #a78bfa;">Tiger Task 🐅</h1>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 14px;">L'organisation du temps inspirée de Fibre Tigre</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Bonjour <strong>${displayName}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Nous sommes ravis de vous accueillir sur <strong>Tiger Task</strong> ! Votre compte a été créé avec succès.</p>
        
        <div style="background-color: rgba(255, 255, 255, 0.03); border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #a78bfa; font-weight: 700;">Qu'est-ce que Tiger Task ?</h2>
          <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">Inspiré du célèbre système d'organisation de <strong>Fibre Tigre</strong>, cet outil SaaS vous permet d'organiser vos tâches par <strong>indice de volonté et de flemme</strong>, jour par jour :</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
            <li>🔴 <strong style="color: #f43f5e;">Rouge :</strong> Reportée par flemme (culpabilité)</li>
            <li>🟡 <strong style="color: #fbbf24;">Jaune :</strong> Reportée à demain</li>
            <li>🟣 <strong style="color: #a78bfa;">Violet :</strong> Reportée indépendamment de la volonté</li>
            <li>🟢 <strong style="color: #10b981;">Vert :</strong> Tâche accomplie avec succès !</li>
          </ul>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">Pour finaliser votre inscription et activer votre compte, veuillez cliquer sur le bouton d'activation ci-dessous :</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); font-size: 15px;">Confirmer l'activation de mon compte 🚀</a>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
          Vous pourrez utiliser notre <strong>Formule Gratuite</strong> de base (planification sur la semaine en cours), ou passer à l'abonnement Premium illimité à tout moment.
        </p>
        
        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; text-align: center;">
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.<br>
          Tiger Task &copy; 2026. Fait avec passion.
        </p>
      </div>
    `;

    sendConfirmationEmail(email, "Bienvenue sur Tiger Task ! 🐅 (Confirmation d'inscription)", welcomeHtml).catch(err => {
      console.error("Failed to send welcome email:", err);
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        email: newUser.email,
        isPremium: newUser.isPremium,
        premiumPlan: newUser.premiumPlan,
        isVerified: newUser.isVerified
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Erreur serveur lors de l'inscription" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Veuillez entrer vos identifiants" });
  }

  try {
    const users = await readUsers();
    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(400).json({ error: "Nom d'utilisateur ou mot de passe incorrect" });
    }

    // Refresh token
    const token = crypto.randomBytes(32).toString("hex");
    user.token = token;
    await writeUsers(users);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        isPremium: !!user.isPremium,
        premiumPlan: user.premiumPlan || null,
        isVerified: !!user.isVerified
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      email: req.user.email,
      isPremium: !!req.user.isPremium,
      premiumPlan: req.user.premiumPlan || null,
      isVerified: !!req.user.isVerified
    }
  });
});

app.get("/api/auth/verify", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).send("L'adresse email est requise pour la vérification.");
  }

  try {
    const users = await readUsers();
    const user = users.find((u: any) => u.email && u.email.toLowerCase() === (email as string).toLowerCase());

    if (!user) {
      return res.status(404).send("Utilisateur non trouvé.");
    }

    user.isVerified = true;
    await writeUsers(users);

    console.log(`[Email Verified] User: ${user.email} verified successfully.`);

    const appUrl = process.env.APP_URL || "https://ais-pre-evkx7o4lzas5x7tzcywqim-959502944243.europe-west2.run.app";
    res.redirect(`${appUrl}?action=activate-success&email=${encodeURIComponent(user.email)}`);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).send("Une erreur est survenue lors de la vérification de l'adresse email.");
  }
});

app.post("/api/auth/resend-verification", authenticateToken, async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Authentification requise" });
  }

  try {
    const appUrl = process.env.APP_URL || "https://ais-pre-evkx7o4lzas5x7tzcywqim-959502944243.europe-west2.run.app";
    const verificationUrl = `${appUrl}/api/auth/verify?email=${encodeURIComponent(user.email)}`;
    
    const welcomeHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #020617; color: #f1f5f9; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #a78bfa;">Tiger Task 🐅</h1>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 14px;">L'organisation du temps inspirée de Fibre Tigre</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Bonjour <strong>${user.displayName}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Veuillez confirmer l'activation de votre compte Tiger Task en cliquant sur le bouton ci-dessous :</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); font-size: 15px;">Confirmer l'activation de mon compte 🚀</a>
        </div>

        <p style="font-size: 14px; line-height: 1.5; color: #94a3b8; text-align: center;">
          Ou copiez ce lien dans votre navigateur : <br>
          <a href="${verificationUrl}" style="color: #a78bfa; text-decoration: underline; font-size: 12px;">${verificationUrl}</a>
        </p>
        
        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; text-align: center;">
          Tiger Task &copy; 2026.
        </p>
      </div>
    `;

    await sendConfirmationEmail(user.email, "Confirmez l'activation de votre compte Tiger Task 🐅", welcomeHtml);
    res.json({ success: true, message: "Email de confirmation renvoyé avec succès." });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Erreur lors du renvoi de l'email." });
  }
});

app.post("/api/auth/subscribe", authenticateToken, async (req, res) => {
  const { plan } = req.body; // 'monthly', 'yearly', or 'free'
  
  if (plan !== 'monthly' && plan !== 'yearly' && plan !== 'free') {
    return res.status(400).json({ error: "Formule d'abonnement invalide" });
  }

  try {
    const users = await readUsers();
    const user = users.find((u: any) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const isPremium = plan !== 'free';
    user.isPremium = isPremium;
    user.premiumPlan = plan;
    await writeUsers(users);

    // Also seed Fibre Tigre sample data to get them started beautifully!
    const userTasks = await readTasks();
    const existingUserTasks = userTasks.filter((t: any) => t.userId === user.id);
    if (existingUserTasks.length === 0) {
      const seededTasks = getSeededTasksForNewUser(user.id);
      userTasks.push(...seededTasks);
      await writeTasks(userTasks);
    }

    // Trigger confirmation email receipt
    const appUrl = process.env.APP_URL || "https://ais-pre-evkx7o4lzas5x7tzcywqim-959502944243.europe-west2.run.app";
    const planLabel = plan === 'monthly' ? "Mensuel" : plan === 'yearly' ? "Annuel" : "Gratuite (Semaine en cours)";
    const price = plan === 'monthly' ? "1,00 € / mois" : plan === 'yearly' ? "10,00 € / an" : "0,00 € (Gratuit)";
    
    let subscriptionHtml = '';
    if (plan === 'free') {
      subscriptionHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #020617; color: #f1f5f9; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #38bdf8;">Tiger Task ✨</h1>
          <p style="margin: 4px 0 0 0; color: #38bdf8; font-size: 14px; font-weight: 600; letter-spacing: 0.05em;">Formule Gratuite Activée</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Bonjour <strong>${user.displayName}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Votre formule d'abonnement gratuite est maintenant active ! Vous pouvez commencer à organiser vos journées dès maintenant.</p>
        
        <div style="background-color: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); padding: 18px; border-radius: 12px; margin: 24px 0;">
          <h2 style="margin: 0 0 14px 0; font-size: 13px; color: #38bdf8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Détails de votre offre</h2>
          <table style="width: 100%; font-size: 14px; color: #94a3b8; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 8px 0;">Utilisateur :</td>
              <td style="padding: 8px 0; text-align: right; color: #f1f5f9;"><strong>${user.displayName}</strong> (${user.email || 'N/A'})</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 8px 0;">Formule :</td>
              <td style="padding: 8px 0; text-align: right; color: #f1f5f9;"><strong>${planLabel}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 8px 0;">Montant :</td>
              <td style="padding: 8px 0; text-align: right; color: #38bdf8; font-size: 16px; font-weight: bold;">${price}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">Statut :</td>
              <td style="padding: 8px 0; text-align: right; color: #38bdf8; font-weight: 600;">Actif ✅ (Limité à la semaine en cours)</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">Avec cette formule gratuite, vous pouvez :</p>
        <ul style="font-size: 14px; color: #cbd5e1; line-height: 1.6; padding-left: 20px;">
          <li>📅 Planifier des tâches sur la semaine en cours (du lundi au dimanche)</li>
          <li>📊 Suivre votre indice de flemme de la semaine</li>
        </ul>
        <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">Pour débloquer la planification illimitée sur toute l'année et conserver un historique complet, vous pouvez passer à la version Premium à tout moment depuis votre tableau de bord.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3); font-size: 15px;">Accéder à mon tableau de bord 🐅</a>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; text-align: center;">
          Merci d'utiliser Tiger Task !<br>
          Besoin d'aide ? Répondez simplement à cet email.<br>
          Tiger Task &copy; 2026.
        </p>
      </div>
      `;
    } else {
      subscriptionHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #020617; color: #f1f5f9; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #34d399;">Tiger Task ✨</h1>
          <p style="margin: 4px 0 0 0; color: #34d399; font-size: 14px; font-weight: 600; letter-spacing: 0.05em;">Abonnement Premium Activé</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Bonjour <strong>${user.displayName}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Félicitations ! Votre paiement a été validé et votre abonnement <strong>Tiger Task Premium</strong> est maintenant entièrement actif. Nous vous remercions pour votre confiance !</p>
        
        <div style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 18px; border-radius: 12px; margin: 24px 0;">
          <h2 style="margin: 0 0 14px 0; font-size: 13px; color: #34d399; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Détails de votre reçu</h2>
          <table style="width: 100%; font-size: 14px; color: #94a3b8; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 8px 0;">Abonné :</td>
              <td style="padding: 8px 0; text-align: right; color: #f1f5f9;"><strong>${user.displayName}</strong> (${user.email || 'N/A'})</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 8px 0;">Formule :</td>
              <td style="padding: 8px 0; text-align: right; color: #f1f5f9;"><strong>${planLabel}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 8px 0;">Montant facturé :</td>
              <td style="padding: 8px 0; text-align: right; color: #34d399; font-size: 16px; font-weight: bold;">${price}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">Statut :</td>
              <td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: 600;">Payé & Actif ✅</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">Vous pouvez désormais profiter de toutes les fonctionnalités avancées, sans limites :</p>
        <ul style="font-size: 14px; color: #cbd5e1; line-height: 1.6; padding-left: 20px;">
          <li>🔥 Planification de tâches illimitée sur toutes les années</li>
          <li>📊 Tableau d'analyse Bento de la productivité et de l'indice de flemme</li>
          <li>🧩 Système unique de gestion de la volonté inspiré de Fibre Tigre</li>
          <li>⚡ Mises à jour instantanées de vos statistiques en temps réel</li>
        </ul>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); font-size: 15px;">Accéder à mon tableau de bord 🐅</a>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; text-align: center;">
          Merci de soutenir le projet indépendant Tiger Task !<br>
          Besoin d'aide ? Répondez simplement à cet email.<br>
          Tiger Task &copy; 2026.
        </p>
      </div>
      `;
    }

    if (user.email) {
      const emailSubject = plan === 'free' ? "Bienvenue sur la formule gratuite de Tiger Task ! 🐅" : "Confirmation d'abonnement Tiger Task Premium ✨";
      sendConfirmationEmail(user.email, emailSubject, subscriptionHtml).catch(err => {
        console.error("Failed to send subscription confirmation email:", err);
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        isPremium: isPremium,
        premiumPlan: plan,
        isVerified: !!user.isVerified
      }
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Erreur serveur lors de la souscription" });
  }
});

// Developer console email routes
app.get("/api/dev/emails", async (req, res) => {
  try {
    const emails = await readEmails();
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement des emails" });
  }
});

app.delete("/api/dev/emails", async (req, res) => {
  try {
    await writeEmails([]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression des emails" });
  }
});

app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find((u: any) => u.id === req.user.id);
    if (user) {
      delete user.token;
      await writeUsers(users);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la déconnexion" });
  }
});


/* ==========================================================================
   TASKS API ENDPOINTS
   ========================================================================== */

app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const tasks = await readTasks();
    let userTasks = tasks.filter((t: any) => t.userId === req.user.id);
    
    // For Free users, limit to the current week's tasks only
    if (req.user.premiumPlan === 'free') {
      const currentWeekDays = getCurrentWeekDateStrings();
      userTasks = userTasks.filter((t: any) => currentWeekDays.includes(t.date));
    }
    
    // Sort chronologically by date, and then by priority desc
    userTasks.sort((a: any, b: any) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return b.priority - a.priority;
    });

    res.json(userTasks);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement des tâches" });
  }
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { text, status, priority, date, description } = req.body;

  if (!text || !date) {
    return res.status(400).json({ error: "Le texte et la date sont requis" });
  }

  // For Free users, restrict creating tasks outside the current week
  if (req.user.premiumPlan === 'free') {
    const currentWeekDays = getCurrentWeekDateStrings();
    if (!currentWeekDays.includes(date)) {
      return res.status(403).json({ error: "Formule Gratuite : Vous ne pouvez ajouter des tâches que pour la semaine en cours." });
    }
  }

  try {
    const tasks = await readTasks();
    const newTask = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      text,
      description: description || "",
      status: status || "white",
      priority: typeof priority === "number" ? priority : 3,
      date, // YYYY-MM-DD
      createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    await writeTasks(tasks);

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: "Erreur de création de tâche" });
  }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { text, status, priority, date, description } = req.body;

  // For Free users, restrict editing tasks to only the current week's dates
  if (req.user.premiumPlan === 'free') {
    const currentWeekDays = getCurrentWeekDateStrings();
    if (date !== undefined && !currentWeekDays.includes(date)) {
      return res.status(403).json({ error: "Formule Gratuite : Vous ne pouvez pas déplacer de tâches hors de la semaine en cours." });
    }
  }

  try {
    const tasks = await readTasks();
    const taskIndex = tasks.findIndex((t: any) => t.id === id && t.userId === req.user.id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    // For Free users, double-check that the existing task isn't in a restricted week
    if (req.user.premiumPlan === 'free') {
      const currentWeekDays = getCurrentWeekDateStrings();
      if (!currentWeekDays.includes(tasks[taskIndex].date)) {
        return res.status(403).json({ error: "Formule Gratuite : Action non autorisée sur une tâche hors de la semaine en cours." });
      }
    }

    const updatedTask = {
      ...tasks[taskIndex],
      text: text !== undefined ? text : tasks[taskIndex].text,
      description: description !== undefined ? description : (tasks[taskIndex].description || ""),
      status: status !== undefined ? status : tasks[taskIndex].status,
      priority: typeof priority === "number" ? priority : tasks[taskIndex].priority,
      date: date !== undefined ? date : tasks[taskIndex].date,
      updatedAt: new Date().toISOString()
    };

    tasks[taskIndex] = updatedTask;
    await writeTasks(tasks);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: "Erreur de mise à jour de la tâche" });
  }
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const tasks = await readTasks();
    const filteredTasks = tasks.filter((t: any) => !(t.id === id && t.userId === req.user.id));

    if (tasks.length === filteredTasks.length) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    await writeTasks(filteredTasks);
    res.json({ success: true, message: "Tâche supprimée" });
  } catch (error) {
    res.status(500).json({ error: "Erreur de suppression de la tâche" });
  }
});

// Special postponement logic:
// Mark current task as postponed (yellow/purple), clone/create a new white ("todo") task for tomorrow.
app.post("/api/tasks/:id/postpone", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // "flemme" (yellow) or "volonte" (purple)

  const status = reason === "volonte" ? "purple" : "yellow";

  try {
    const tasks = await readTasks();
    const taskIndex = tasks.findIndex((t: any) => t.id === id && t.userId === req.user.id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    const originalTask = tasks[taskIndex];
    
    // 1. Update original task status to yellow/purple
    originalTask.status = status;
    originalTask.updatedAt = new Date().toISOString();

    // 2. Compute tomorrow's date based on the task's original date
    const originalDate = new Date(originalTask.date);
    const tomorrow = new Date(originalDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // For Free users, restrict postponing a task beyond the current week
    if (req.user.premiumPlan === 'free') {
      const currentWeekDays = getCurrentWeekDateStrings();
      if (!currentWeekDays.includes(tomorrowStr)) {
        return res.status(403).json({ error: "Formule Gratuite : Le report dépasse la fin de la semaine en cours. Passez au Premium pour reporter au-delà !" });
      }
    }

    // 3. Create cloned task for tomorrow
    // Append a notice to track the history elegantly
    const cleanText = originalTask.text.replace(/\s*\(depuis hier\)/g, "").replace(/\s*\(reporté\)/g, "");
    const clonedTask = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      text: `${cleanText} (depuis hier)`,
      status: "white", // Reset to todo
      priority: originalTask.priority,
      date: tomorrowStr,
      description: originalTask.description || "",
      createdAt: new Date().toISOString()
    };

    tasks.push(clonedTask);
    await writeTasks(tasks);

    res.json({
      original: originalTask,
      cloned: clonedTask
    });
  } catch (error) {
    console.error("Postpone error:", error);
    res.status(500).json({ error: "Erreur lors du report de la tâche" });
  }
});


/* ==========================================================================
   STATS API ENDPOINT
   ========================================================================== */

app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const tasks = await readTasks();
    let userTasks = tasks.filter((t: any) => t.userId === req.user.id);

    // For Free users, only calculate statistics from the current week's tasks
    if (req.user.premiumPlan === 'free') {
      const currentWeekDays = getCurrentWeekDateStrings();
      userTasks = userTasks.filter((t: any) => currentWeekDays.includes(t.date));
    }

    const total = userTasks.length;
    const completed = userTasks.filter((t: any) => t.status === "green" || t.status === "blue").length;
    const postponedFlemme = userTasks.filter((t: any) => t.status === "yellow").length;
    const postponedVolonte = userTasks.filter((t: any) => t.status === "purple").length;
    const failedGuilt = userTasks.filter((t: any) => t.status === "red").length;
    const failedSad = userTasks.filter((t: any) => t.status === "black").length;
    const todo = userTasks.filter((t: any) => t.status === "white").length;

    // Flemme Index (Yellow + Red) over total actions finished or postponed
    const totalConcluded = completed + postponedFlemme + postponedVolonte + failedGuilt + failedSad;
    const flemmeIndex = totalConcluded > 0 
      ? Math.round(((postponedFlemme + failedGuilt) / totalConcluded) * 100) 
      : 0;

    // Hard work indicator: average priority score of completed tasks
    const completedTasks = userTasks.filter((t: any) => t.status === "green" || t.status === "blue");
    const avgCompletedPriority = completedTasks.length > 0
      ? parseFloat((completedTasks.reduce((acc: number, t: any) => acc + t.priority, 0) / completedTasks.length).toFixed(1))
      : 0;

    // Grouped completions over last 7 active days
    const datesMap: { [key: string]: { done: number; postponed: number; failed: number } } = {};
    
    // Sort unique dates
    const uniqueDates = Array.from(new Set(userTasks.map((t: any) => t.date))).sort();
    const lastDates = uniqueDates.slice(-7); // Last 7 days

    lastDates.forEach((d: string) => {
      const dayTasks = userTasks.filter((t: any) => t.date === d);
      datesMap[d] = {
        done: dayTasks.filter((t: any) => t.status === "green" || t.status === "blue").length,
        postponed: dayTasks.filter((t: any) => t.status === "yellow" || t.status === "purple").length,
        failed: dayTasks.filter((t: any) => t.status === "red" || t.status === "black").length
      };
    });

    res.json({
      distribution: {
        total,
        todo,
        completed,
        postponedFlemme,
        postponedVolonte,
        failedGuilt,
        failedSad
      },
      flemmeIndex,
      avgCompletedPriority,
      history7Days: datesMap
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur d'analyse statistique" });
  }
});


/* ==========================================================================
   VITE & STATIC ASSETS SETUP
   ========================================================================== */

async function startServer() {
  await ensureDataDir();
  await cleanupUserAccounts();

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tiger Task server running on http://localhost:${PORT}`);
  });
}

startServer();
