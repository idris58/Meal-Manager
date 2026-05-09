import type { Express } from "express";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

    if (!shareLink || !shareLink.is_enabled) {
      return res.status(404).json({ message: "Shared view not found." });
    }

    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("cycles")
      .select("id, name, status, started_at, closed_at, members_snapshot")
      .eq("user_id", shareLink.user_id)
      .in("status", ["pending", "active"])
      .order("closed_at", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cycleError) {
      throw cycleError;
    }

    if (!cycle) {
      return res.status(404).json({ message: "No shareable cycle found." });
    }

    const [membersResult, depositsResult, expensesResult, mealLogsResult] = await Promise.all([
        supabaseAdmin
          .from("members")
          .select("id, name, avatar")
          .eq("user_id", shareLink.user_id)
          .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("cycle_deposits")
        .select("id, cycle_id, member_id, amount")
        .eq("user_id", shareLink.user_id)
        .eq("cycle_id", cycle.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("expenses")
        .select("id, cycle_id, amount, description, type, date, paid_by")
        .eq("user_id", shareLink.user_id)
        .eq("cycle_id", cycle.id)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("meal_logs")
        .select("id, cycle_id, date, member_id, count")
        .eq("user_id", shareLink.user_id)
        .eq("cycle_id", cycle.id)
        .order("date", { ascending: false }),
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

    return res.json(
      buildSharedPayload(
        cycle,
        membersResult.data || [],
        depositsResult.data || [],
        expensesResult.data || [],
        mealLogsResult.data || [],
      ),
    );
  });

  return httpServer;
}
