import type { Express, Response } from "express";
import { type Server } from "http";

import { assertSupabaseAdmin } from "./supabase-admin";

type MemberRow = {
  id: string;
  name: string;
  avatar: string | null;
};

type SnapshotMember = {
  id: string;
  name: string;
  avatar?: string;
};

type CycleRow = {
  id: string;
  name: string;
  status: "active" | "pending" | "closed";
  started_at: string;
  closed_at: string | null;
  members_snapshot: SnapshotMember[] | null;
};

type ExpenseRow = {
  id: string;
  cycle_id: string;
  amount: number | string;
  description: string;
  type: "meal" | "fixed";
  date: string;
  paid_by: string;
};

type MealLogRow = {
  id: string;
  cycle_id: string;
  date: string;
  member_id: string;
  count: number | string;
};

type CycleDepositRow = {
  id: string;
  cycle_id: string;
  member_id: string;
  amount: number | string;
};

function buildSharedPayload(
  cycle: CycleRow,
  membersData: MemberRow[],
  depositsData: CycleDepositRow[],
  expensesData: ExpenseRow[],
  mealLogsData: MealLogRow[],
) {
  const members =
    cycle.status === "active" || !cycle.members_snapshot
      ? membersData.map((member) => ({
          id: member.id,
          name: member.name,
          avatar: member.avatar || member.name.substring(0, 2).toUpperCase(),
        }))
      : cycle.members_snapshot.map((member) => ({
          id: member.id,
          name: member.name,
          avatar: member.avatar || member.name.substring(0, 2).toUpperCase(),
        }));

  const depositsByMember = new Map<string, number>();
  for (const deposit of depositsData) {
    depositsByMember.set(
      deposit.member_id,
      (depositsByMember.get(deposit.member_id) || 0) + Number(deposit.amount),
    );
  }

  const expenses = expensesData.map((expense) => ({
    id: expense.id,
    amount: Number(expense.amount),
    description: expense.description,
    type: expense.type,
    date: expense.date,
    paidBy: expense.paid_by,
  }));

  const mealLogs = mealLogsData.map((log) => ({
    id: log.id,
    date: log.date,
    memberId: log.member_id,
    count: Number(log.count),
  }));

  const totalMealExpenses = expenses
    .filter((expense) => expense.type === "meal")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const totalFixedExpenses = expenses
    .filter((expense) => expense.type === "fixed")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const totalMealsConsumed = mealLogs.reduce((sum, log) => sum + log.count, 0);
  const memberCount = members.length;
  const currentMealRate =
    totalMealsConsumed > 0 ? totalMealExpenses / totalMealsConsumed : 0;
  const fixedCostPerMember =
    memberCount > 0 ? totalFixedExpenses / memberCount : 0;

  const memberSummaries = members.map((member) => {
    const mealsEaten = mealLogs
      .filter((log) => log.memberId === member.id)
      .reduce((sum, log) => sum + log.count, 0);
    const deposit = depositsByMember.get(member.id) || 0;
    const mealCost = mealsEaten * currentMealRate;
    const fixedCost = fixedCostPerMember;
    const totalCost = mealCost + fixedCost;
    const balance = deposit - totalCost;

    return {
      ...member,
      deposit,
      mealsEaten,
      mealCost,
      fixedCost,
      totalCost,
      balance,
    };
  });

  const totalDeposits = memberSummaries.reduce(
    (sum, member) => sum + member.deposit,
    0,
  );
  const remainingCash = totalDeposits - (totalMealExpenses + totalFixedExpenses);

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      closedAt: cycle.closed_at,
    },
    stats: {
      totalDeposits,
      totalMealExpenses,
      totalFixedExpenses,
      totalMealsConsumed,
      currentMealRate,
      fixedCostPerMember,
      remainingCash,
    },
    members: memberSummaries,
    expenses,
    mealLogs,
  };
}

type NoticeRow = {
  id: string;
  title: string;
  content: string;
  expires_at: string;
};

type ActiveNotice = {
  id: string;
  title: string;
  content: string;
  expiresAt: string;
} | null;

type SharedPayload = ReturnType<typeof buildSharedPayload> & {
  activeNotice: ActiveNotice;
};

const shareEventClients = new Map<string, Set<Response>>();

function addShareEventClient(userId: string, res: Response) {
  const clients = shareEventClients.get(userId) ?? new Set<Response>();
  clients.add(res);
  shareEventClients.set(userId, clients);
}

function removeShareEventClient(userId: string, res: Response) {
  const clients = shareEventClients.get(userId);
  if (!clients) {
    return;
  }

  clients.delete(res);
  if (clients.size === 0) {
    shareEventClients.delete(userId);
  }
}

function sendShareEvent(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastNoticeUpdate(userId: string, activeNotice: ActiveNotice) {
  const clients = shareEventClients.get(userId);
  if (!clients) {
    return;
  }

  for (const client of Array.from(clients)) {
    sendShareEvent(client, "notice", { activeNotice });
  }
}

function broadcastSharedPayload(userId: string, data: SharedPayload | null) {
  const clients = shareEventClients.get(userId);
  if (!clients) {
    return;
  }

  for (const client of Array.from(clients)) {
    sendShareEvent(client, "shared-data", { data });
  }
}

async function getActiveNoticeForUser(userId: string): Promise<ActiveNotice> {
  const supabaseAdmin = assertSupabaseAdmin();
  const now = new Date().toISOString();

  const { error: cleanupError } = await supabaseAdmin
    .from("notices")
    .delete()
    .eq("user_id", userId)
    .lte("expires_at", now);

  if (cleanupError) {
    console.error("Error deleting expired notices:", cleanupError);
  }

  const { data, error } = await supabaseAdmin
    .from("notices")
    .select("id, title, content, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error loading active notice:", error);
    return null;
  }

  const noticeRow = data as NoticeRow | null;
  return noticeRow
    ? {
        id: noticeRow.id,
        title: noticeRow.title,
        content: noticeRow.content,
        expiresAt: noticeRow.expires_at,
      }
    : null;
}

async function getSharedPayloadForUser(userId: string): Promise<SharedPayload | null> {
  const supabaseAdmin = assertSupabaseAdmin();

  const { data: cycle, error: cycleError } = await supabaseAdmin
    .from("cycles")
    .select("id, name, status, started_at, closed_at, members_snapshot")
    .eq("user_id", userId)
    .in("status", ["pending", "active"])
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cycleError) {
    throw cycleError;
  }

  if (!cycle) {
    return null;
  }

  const [membersResult, depositsResult, expensesResult, mealLogsResult, activeNotice] =
    await Promise.all([
      supabaseAdmin
        .from("members")
        .select("id, name, avatar")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("cycle_deposits")
        .select("id, cycle_id, member_id, amount")
        .eq("user_id", userId)
        .eq("cycle_id", cycle.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("expenses")
        .select("id, cycle_id, amount, description, type, date, paid_by")
        .eq("user_id", userId)
        .eq("cycle_id", cycle.id)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("meal_logs")
        .select("id, cycle_id, date, member_id, count")
        .eq("user_id", userId)
        .eq("cycle_id", cycle.id)
        .order("date", { ascending: false }),
      getActiveNoticeForUser(userId),
    ]);

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (depositsResult.error) {
    throw depositsResult.error;
  }

  if (expensesResult.error) {
    throw expensesResult.error;
  }

  if (mealLogsResult.error) {
    throw mealLogsResult.error;
  }

  return {
    ...buildSharedPayload(
      cycle,
      membersResult.data || [],
      depositsResult.data || [],
      expensesResult.data || [],
      mealLogsResult.data || [],
    ),
    activeNotice,
  };
}

async function getAuthenticatedUserId(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return null;
  }

  const supabaseAdmin = assertSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/share/:token/events", async (req, res) => {
    const token = String(req.params.token || "").trim();

    if (!token) {
      return res.status(400).json({ message: "Missing share token." });
    }

    const supabaseAdmin = assertSupabaseAdmin();

    const { data: shareLink, error: shareLinkError } = await supabaseAdmin
      .from("share_links")
      .select("user_id, is_enabled")
      .eq("token", token)
      .maybeSingle();

    if (shareLinkError) {
      throw shareLinkError;
    }

    if (!shareLink || !shareLink.is_enabled) {
      return res.status(404).json({ message: "This Meal Code is not available for live updates." });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    addShareEventClient(shareLink.user_id, res);
    sendShareEvent(res, "connected", { ok: true });

    const heartbeatId = setInterval(() => {
      sendShareEvent(res, "heartbeat", { at: new Date().toISOString() });
    }, 30000);

    req.on("close", () => {
      clearInterval(heartbeatId);
      removeShareEventClient(shareLink.user_id, res);
      res.end();
    });
  });

  app.post("/api/notices/broadcast", async (req, res) => {
    const userId = await getAuthenticatedUserId(req.get("authorization"));

    if (!userId) {
      return res.status(401).json({ message: "Invalid authorization token." });
    }

    const activeNotice = await getActiveNoticeForUser(userId);
    broadcastNoticeUpdate(userId, activeNotice);

    return res.json({ activeNotice });
  });

  app.post("/api/share/broadcast", async (req, res) => {
    const userId = await getAuthenticatedUserId(req.get("authorization"));

    if (!userId) {
      return res.status(401).json({ message: "Invalid authorization token." });
    }

    const data = await getSharedPayloadForUser(userId);
    broadcastSharedPayload(userId, data);

    return res.json({ data });
  });

  app.get("/api/share/:token", async (req, res) => {
    const token = String(req.params.token || "").trim();

    if (!token) {
      return res.status(400).json({ message: "Missing share token." });
    }

    const supabaseAdmin = assertSupabaseAdmin();

    const { data: shareLink, error: shareLinkError } = await supabaseAdmin
      .from("share_links")
      .select("user_id, is_enabled")
      .eq("token", token)
      .maybeSingle();

    if (shareLinkError) {
      throw shareLinkError;
    }

    if (!shareLink) {
      return res.status(404).json({ message: "This Meal Code does not match an active shared view." });
    }

    if (!shareLink.is_enabled) {
      return res.status(404).json({ message: "Sharing is currently disabled for this Meal Code. Ask the manager to enable sharing again." });
    }

    const data = await getSharedPayloadForUser(shareLink.user_id);

    if (!data) {
      return res.status(404).json({ message: "No active or pending cycle is available for this shared view yet." });
    }

    return res.json(data);

  });

  return httpServer;
}
