import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export interface Member {
  id: string;
  name: string;
  deposit: number;
  mealsEaten: number;
  avatar?: string;
}

export interface Expense {
  id: string;
  cycleId: string;
  amount: number;
  description: string;
  type: 'meal' | 'fixed';
  date: string;
  paidBy: string;
}

export interface MealLog {
  id: string;
  cycleId: string;
  date: string;
  memberId: string;
  count: number;
}

export interface CycleDeposit {
  id: string;
  cycleId: string;
  memberId: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export type CycleStatus = 'active' | 'pending' | 'closed';
export type ChangelogEntityType = 'member' | 'expense' | 'meal_log' | 'deposit';
export type ChangelogAction = 'create' | 'update' | 'delete';

type ChangelogValue = string | number | boolean | null;

export interface ChangelogChange {
  field: string;
  label: string;
  value?: ChangelogValue;
  from?: ChangelogValue;
  to?: ChangelogValue;
}

export interface ChangelogEntry {
  id: string;
  cycleId: string;
  entityType: ChangelogEntityType;
  entityId: string;
  action: ChangelogAction;
  title: string;
  changes: ChangelogChange[];
  createdAt: string;
}

export interface Cycle {
  id: string;
  name: string;
  status: CycleStatus;
  startedAt: string;
  closedAt?: string | null;
  finalizedAt?: string | null;
  membersSnapshot?: SnapshotMember[] | null;
}

type SnapshotMember = {
  id: string;
  name: string;
  avatar?: string;
};

export interface CycleDetails {
  cycle: Cycle;
  stats: {
    totalDeposits: number;
    totalMealExpenses: number;
    totalFixedExpenses: number;
    totalMealsConsumed: number;
    currentMealRate: number;
    fixedCostPerMember: number;
    remainingCash: number;
  };
  members: (Member & { mealCost: number; fixedCost: number; totalCost: number; balance: number })[];
  expenses: Expense[];
  mealLogs: MealLog[];
  deposits: CycleDeposit[];
}

interface MealContextType {
  members: Member[];
  expenses: Expense[];
  mealLogs: MealLog[];
  cycles: Cycle[];
  activeCycleChangelogEntries: ChangelogEntry[];
  pendingCycleChangelogEntries: ChangelogEntry[];
  activeCycle: Cycle | null;
  pendingCycle: Cycle | null;
  loading: boolean;
  addMember: (name: string) => Promise<void>;
  updateMember: (id: string, updates: Partial<Member>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  addExpense: (amount: number, description: string, type: 'meal' | 'fixed', paidBy: string, cycleId?: string, expenseDate?: string) => Promise<void>;
  updateExpense: (id: string, updates: {
    amount: number;
    description: string;
    type: 'meal' | 'fixed';
    paidBy: string;
    date?: string;
  }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addDeposit: (memberId: string, amount: number, cycleId?: string, note?: string) => Promise<void>;
  saveMealLogs: (entries: Array<{ memberId: string; count: number }>, date: string, cycleId?: string) => Promise<void>;
  logMeal: (memberId: string, count: number, date: string, cycleId?: string) => Promise<void>;
  renameActiveCycle: (name: string) => Promise<void>;
  closeActiveCycle: () => Promise<void>;
  markCycleClosed: (cycleId: string) => Promise<void>;
  deleteCycle: (cycleId: string) => Promise<void>;
  stats: CycleDetails['stats'];
  getMemberStats: (memberId: string, cycleId?: string) => {
    mealCost: number;
    fixedCost: number;
    totalCost: number;
    balance: number;
    mealsEaten: number;
  };
  getCycleDetails: (cycleId: string) => CycleDetails | null;
}

const MealContext = createContext<MealContextType | undefined>(undefined);

type MemberRow = {
  id: string;
  name: string;
  avatar: string | null;
};

type CycleRow = {
  id: string;
  name: string | null;
  status: CycleStatus;
  started_at: string;
  closed_at: string | null;
  finalized_at: string | null;
  members_snapshot: SnapshotMember[] | null;
  created_at: string;
};

type ExpenseRow = {
  id: string;
  cycle_id: string;
  amount: number | string;
  description: string;
  type: 'meal' | 'fixed';
  date: string;
  paid_by: string;
};

type MealLogRow = {
  id: string;
  cycle_id: string;
  member_id: string;
  date: string;
  count: number | string;
};

type CycleDepositRow = {
  id: string;
  cycle_id: string;
  member_id: string;
  amount: number | string;
  note: string | null;
  created_at: string;
};

type ChangelogRow = {
  id: string;
  cycle_id: string;
  entity_type: ChangelogEntityType;
  entity_id: string;
  action: ChangelogAction;
  title: string;
  changes: ChangelogChange[] | null;
  created_at: string;
};

function toAvatar(name: string, fallback?: string | null) {
  return fallback || name.substring(0, 2).toUpperCase();
}

function getCycleSeasonName(dateValue: string | Date) {
  const month = dateValue instanceof Date ? dateValue.getMonth() : new Date(dateValue).getMonth();

  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

function getDefaultCycleBaseName(dateValue: string | Date) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const year = String(date.getFullYear()).slice(-2);
  return `Meal_${getCycleSeasonName(date)}-${year}`;
}

function generateUniqueCycleName(dateValue: string | Date, existingCycles: Cycle[]) {
  const baseName = getDefaultCycleBaseName(dateValue);
  const existingNames = new Set(
    existingCycles.map((cycle) => cycle.name.trim().toLowerCase()).filter(Boolean),
  );

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let suffix = 1;
  let candidate = `${baseName}_${suffix}`;

  while (existingNames.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${baseName}_${suffix}`;
  }

  return candidate;
}

function buildUpdateChange(
  field: string,
  label: string,
  from: ChangelogValue,
  to: ChangelogValue,
): ChangelogChange | null {
  return from === to ? null : { field, label, from, to };
}

function buildSnapshotChange(field: string, label: string, value: ChangelogValue): ChangelogChange {
  return { field, label, value };
}

function getMealLogAction(changes: ChangelogChange[]): ChangelogAction {
  const created = changes.some((change) => change.from === 0 && typeof change.to === 'number' && change.to > 0);
  const deleted = changes.some((change) => typeof change.from === 'number' && change.from > 0 && change.to === 0);
  const updated = changes.some((change) => typeof change.from === 'number' && typeof change.to === 'number' && change.from > 0 && change.to > 0 && change.from !== change.to);

  if (updated || (created && deleted) || (created && updated) || (deleted && updated)) {
    return 'update';
  }

  if (deleted) return 'delete';
  if (created) return 'create';
  return 'update';
}

export function MealProvider({ children }: { children: ReactNode }) {
  const [memberRoster, setMemberRoster] = useState<Member[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allMealLogs, setAllMealLogs] = useState<MealLog[]>([]);
  const [allDeposits, setAllDeposits] = useState<CycleDeposit[]>([]);
  const [allChangelogEntries, setAllChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
      }
    };

    void getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      void loadData();
    }
  }, [userId]);

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.status === 'active') ?? null,
    [cycles],
  );

  const pendingCycle = useMemo(
    () => cycles.find((cycle) => cycle.status === 'pending') ?? null,
    [cycles],
  );

  const activeCycleChangelogEntries = useMemo(
    () => activeCycle ? allChangelogEntries.filter((entry) => entry.cycleId === activeCycle.id) : [],
    [activeCycle, allChangelogEntries],
  );

  const pendingCycleChangelogEntries = useMemo(
    () => pendingCycle ? allChangelogEntries.filter((entry) => entry.cycleId === pendingCycle.id) : [],
    [allChangelogEntries, pendingCycle],
  );

  const getCycleMembers = (cycleId: string) => {
    const cycle = cycles.find((entry) => entry.id === cycleId);
    if (!cycle) {
      return [];
    }

    const snapshot = cycle.membersSnapshot;

    if (snapshot && cycle.status !== 'active') {
        return snapshot.map((member) => ({
          id: member.id,
          name: member.name,
          deposit: 0,
          mealsEaten: 0,
          avatar: toAvatar(member.name, member.avatar),
        }));
      }

    return memberRoster.map((member) => ({
      ...member,
      deposit: 0,
      mealsEaten: 0,
    }));
  };

  const getMemberName = (memberId: string, cycleId?: string) => {
    const scopedMembers = cycleId ? getCycleMembers(cycleId) : memberRoster;
    return scopedMembers.find((member) => member.id === memberId)?.name ?? 'Unknown member';
  };

  const recordChangelog = async ({
    cycleId,
    entityType,
    entityId,
    action,
    title,
    changes,
  }: {
    cycleId: string | null;
    entityType: ChangelogEntityType;
    entityId: string;
    action: ChangelogAction;
    title: string;
    changes: ChangelogChange[];
  }) => {
    if (!userId || !cycleId) return;

    const { data, error } = await supabase
      .from('changelog_entries')
      .insert([{
        user_id: userId,
        cycle_id: cycleId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        title,
        changes,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error recording changelog entry:', error);
      return;
    }

    setAllChangelogEntries((prev) => [{
      id: data.id,
      cycleId: data.cycle_id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      action: data.action,
      title: data.title,
      changes: (data.changes as ChangelogChange[] | null) ?? [],
      createdAt: data.created_at,
    }, ...prev]);
  };

  const getCycleDetails = (cycleId: string): CycleDetails | null => {
    const cycle = cycles.find((entry) => entry.id === cycleId);
    if (!cycle) {
      return null;
    }

    const cycleMembers = getCycleMembers(cycleId);
    const cycleExpenses = allExpenses.filter((expense) => expense.cycleId === cycleId);
    const cycleMealLogs = allMealLogs.filter((log) => log.cycleId === cycleId);
    const cycleDeposits = allDeposits.filter((deposit) => deposit.cycleId === cycleId);

    const depositByMember = new Map<string, number>();
    for (const deposit of cycleDeposits) {
      depositByMember.set(
        deposit.memberId,
        (depositByMember.get(deposit.memberId) ?? 0) + deposit.amount,
      );
    }

    const baseMembers = cycleMembers.map((member) => ({
      ...member,
      deposit: depositByMember.get(member.id) ?? 0,
      mealsEaten: cycleMealLogs
        .filter((log) => log.memberId === member.id)
        .reduce((sum, log) => sum + log.count, 0),
    }));

    const totalDeposits = baseMembers.reduce((sum, member) => sum + member.deposit, 0);
    const totalMealExpenses = cycleExpenses
      .filter((expense) => expense.type === 'meal')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalFixedExpenses = cycleExpenses
      .filter((expense) => expense.type === 'fixed')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalMealsConsumed = cycleMealLogs.reduce((sum, log) => sum + log.count, 0);
    const memberCount = baseMembers.length;
    const currentMealRate = totalMealsConsumed > 0 ? totalMealExpenses / totalMealsConsumed : 0;
    const fixedCostPerMember = memberCount > 0 ? totalFixedExpenses / memberCount : 0;
    const remainingCash = totalDeposits - (totalMealExpenses + totalFixedExpenses);

    const computedMembers = baseMembers.map((member) => {
      const mealCost = member.mealsEaten * currentMealRate;
      const fixedCost = fixedCostPerMember;
      const totalCost = mealCost + fixedCost;
      const balance = member.deposit - totalCost;

      return {
        ...member,
        mealCost,
        fixedCost,
        totalCost,
        balance,
      };
    });

    return {
      cycle,
      stats: {
        totalDeposits,
        totalMealExpenses,
        totalFixedExpenses,
        totalMealsConsumed,
        currentMealRate,
        fixedCostPerMember,
        remainingCash,
      },
      members: computedMembers,
      expenses: cycleExpenses,
      mealLogs: cycleMealLogs,
      deposits: cycleDeposits,
    };
  };

  const loadData = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const [
        membersResult,
        cyclesResult,
        depositsResult,
        expensesResult,
        mealLogsResult,
        changelogResult,
      ] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        supabase
          .from('cycles')
          .select('*')
          .eq('user_id', userId)
          .order('started_at', { ascending: false }),
        supabase
          .from('cycle_deposits')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false }),
        supabase
          .from('meal_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false }),
        supabase
          .from('changelog_entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (membersResult.error) throw membersResult.error;
      if (cyclesResult.error) throw cyclesResult.error;
      if (depositsResult.error) throw depositsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (mealLogsResult.error) throw mealLogsResult.error;
      if (changelogResult.error) throw changelogResult.error;

      const nextMembers = ((membersResult.data || []) as MemberRow[]).map((member) => ({
        id: member.id,
        name: member.name,
        deposit: 0,
        mealsEaten: 0,
        avatar: toAvatar(member.name, member.avatar),
      }));

      const nextCycles = ((cyclesResult.data || []) as CycleRow[]).map((cycle) => ({
        id: cycle.id,
        name: cycle.name || getDefaultCycleBaseName(cycle.started_at),
        status: cycle.status,
        startedAt: cycle.started_at,
        closedAt: cycle.closed_at,
        finalizedAt: cycle.finalized_at,
        membersSnapshot: cycle.members_snapshot,
      }));

      const nextDeposits = ((depositsResult.data || []) as CycleDepositRow[]).map((deposit) => ({
        id: deposit.id,
        cycleId: deposit.cycle_id,
        memberId: deposit.member_id,
        amount: Number(deposit.amount),
        note: deposit.note ?? undefined,
        createdAt: deposit.created_at,
      }));

      const nextExpenses = ((expensesResult.data || []) as ExpenseRow[])
        .filter((expense) => Boolean(expense.cycle_id))
        .map((expense) => ({
          id: expense.id,
          cycleId: expense.cycle_id,
          amount: Number(expense.amount),
          description: expense.description,
          type: expense.type,
          date: expense.date,
          paidBy: expense.paid_by,
        }));

      const nextMealLogs = ((mealLogsResult.data || []) as MealLogRow[])
        .filter((log) => Boolean(log.cycle_id))
        .map((log) => ({
          id: log.id,
          cycleId: log.cycle_id,
          memberId: log.member_id,
          date: log.date,
          count: Number(log.count),
        }));

      const nextChangelogEntries = ((changelogResult.data || []) as ChangelogRow[]).map((entry) => ({
        id: entry.id,
        cycleId: entry.cycle_id,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        action: entry.action,
        title: entry.title,
        changes: entry.changes ?? [],
        createdAt: entry.created_at,
      }));

      setMemberRoster(nextMembers);
      setCycles(nextCycles);
      setAllDeposits(nextDeposits);
      setAllExpenses(nextExpenses);
      setAllMealLogs(nextMealLogs);
      setAllChangelogEntries(nextChangelogEntries);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRequiredCycleId = (requestedCycleId?: string) => {
    return requestedCycleId ?? activeCycle?.id ?? null;
  };

  const addMember = async (name: string) => {
    if (!userId) return;
    const targetCycleId = activeCycle?.id ?? null;

    const avatar = name.substring(0, 2).toUpperCase();
    const { data, error } = await supabase
      .from('members')
      .insert([{ name, avatar, user_id: userId }])
      .select()
      .single();

    if (error) {
      console.error('Error adding member:', error);
      return;
    }

    setMemberRoster((prev) => [
      ...prev,
      {
        id: data.id,
        name: data.name,
        deposit: 0,
        mealsEaten: 0,
        avatar: toAvatar(data.name, data.avatar),
      },
    ]);

    await recordChangelog({
      cycleId: targetCycleId,
      entityType: 'member',
      entityId: data.id,
      action: 'create',
      title: `Added member ${data.name}`,
      changes: [
        buildSnapshotChange('name', 'Name', data.name),
      ],
    });
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    if (!userId) return;
    const existingMember = memberRoster.find((member) => member.id === id);
    const targetCycleId = activeCycle?.id ?? null;
    if (!existingMember) return;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;

    const changes = [
      buildUpdateChange('name', 'Name', existingMember.name, updates.name ?? existingMember.name),
      buildUpdateChange('avatar', 'Avatar', existingMember.avatar ?? null, updates.avatar ?? existingMember.avatar ?? null),
    ].filter((change): change is ChangelogChange => Boolean(change));

    if (changes.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('members')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating member:', error);
      return;
    }

    setMemberRoster((prev) => prev.map((member) => (
      member.id === id
        ? {
            ...member,
            ...updates,
            deposit: member.deposit,
            mealsEaten: member.mealsEaten,
          }
        : member
    )));

    await recordChangelog({
      cycleId: targetCycleId,
      entityType: 'member',
      entityId: id,
      action: 'update',
      title: `Updated member ${existingMember.name}`,
      changes,
    });
  };

  const removeMember = async (id: string) => {
    if (!userId) return;
    const existingMember = memberRoster.find((member) => member.id === id);
    const targetCycleId = activeCycle?.id ?? null;
    if (!existingMember) return;

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
      return;
    }

    setMemberRoster((prev) => prev.filter((member) => member.id !== id));
    setAllMealLogs((prev) => prev.filter((log) => log.memberId !== id));
    setAllDeposits((prev) => prev.filter((deposit) => deposit.memberId !== id));

    await recordChangelog({
      cycleId: targetCycleId,
      entityType: 'member',
      entityId: id,
      action: 'delete',
      title: `Deleted member ${existingMember.name}`,
      changes: [
        buildSnapshotChange('name', 'Name', existingMember.name),
      ],
    });
  };

  const addExpense = async (
    amount: number,
    description: string,
    type: 'meal' | 'fixed',
    paidBy: string,
    cycleId?: string,
    expenseDate?: string,
  ) => {
    if (!userId) return;

    const targetCycleId = getRequiredCycleId(cycleId);
    if (!targetCycleId) return;

    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        amount,
        description,
        type,
        paid_by: paidBy,
        date: expenseDate ?? new Date().toISOString(),
        user_id: userId,
        cycle_id: targetCycleId,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding expense:', error);
      return;
    }

    setAllExpenses((prev) => [{
      id: data.id,
      cycleId: data.cycle_id,
      amount: Number(data.amount),
      description: data.description,
      type: data.type,
      date: data.date,
      paidBy: data.paid_by,
    }, ...prev]);

    await recordChangelog({
      cycleId: targetCycleId,
      entityType: 'expense',
      entityId: data.id,
      action: 'create',
      title: `Added ${data.type} expense`,
      changes: [
        buildSnapshotChange('description', 'Description', data.description),
        buildSnapshotChange('amount', 'Amount', Number(data.amount)),
        buildSnapshotChange('type', 'Type', data.type),
        buildSnapshotChange('paid_by', 'Paid By', data.paid_by),
        buildSnapshotChange('date', 'Date', data.date),
      ],
    });
  };

  const updateExpense = async (
    id: string,
    updates: {
      amount: number;
      description: string;
      type: 'meal' | 'fixed';
      paidBy: string;
      date?: string;
    },
  ) => {
    if (!userId) return;
    const existingExpense = allExpenses.find((expense) => expense.id === id);
    if (!existingExpense) return;

    const changes = [
      buildUpdateChange('amount', 'Amount', existingExpense.amount, updates.amount),
      buildUpdateChange('description', 'Description', existingExpense.description, updates.description),
      buildUpdateChange('type', 'Type', existingExpense.type, updates.type),
      buildUpdateChange('paid_by', 'Paid By', existingExpense.paidBy, updates.paidBy),
    ].filter((change): change is ChangelogChange => Boolean(change));

    if (changes.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('expenses')
      .update({
        amount: updates.amount,
        description: updates.description,
        type: updates.type,
        paid_by: updates.paidBy,
        ...(updates.date ? { date: updates.date } : {}),
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating expense:', error);
      return;
    }

    setAllExpenses((prev) => prev.map((expense) => (
      expense.id === id
        ? {
            ...expense,
            amount: updates.amount,
            description: updates.description,
            type: updates.type,
            paidBy: updates.paidBy,
            date: updates.date ?? expense.date,
          }
        : expense
    )));

    await recordChangelog({
      cycleId: existingExpense.cycleId,
      entityType: 'expense',
      entityId: id,
      action: 'update',
      title: `Updated ${existingExpense.type} expense`,
      changes,
    });
  };

  const deleteExpense = async (id: string) => {
    if (!userId) return;
    const existingExpense = allExpenses.find((expense) => expense.id === id);
    if (!existingExpense) return;

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting expense:', error);
      return;
    }

    setAllExpenses((prev) => prev.filter((expense) => expense.id !== id));

    await recordChangelog({
      cycleId: existingExpense.cycleId,
      entityType: 'expense',
      entityId: id,
      action: 'delete',
      title: `Deleted ${existingExpense.type} expense`,
      changes: [
        buildSnapshotChange('description', 'Description', existingExpense.description),
        buildSnapshotChange('amount', 'Amount', existingExpense.amount),
        buildSnapshotChange('type', 'Type', existingExpense.type),
        buildSnapshotChange('paid_by', 'Paid By', existingExpense.paidBy),
        buildSnapshotChange('date', 'Date', existingExpense.date),
      ],
    });
  };

  const addDeposit = async (memberId: string, amount: number, cycleId?: string, note?: string) => {
    if (!userId || amount === 0) return;

    const targetCycleId = getRequiredCycleId(cycleId);
    if (!targetCycleId) return;
    const memberName = getMemberName(memberId, targetCycleId);
    const previousDepositBalance = allDeposits
      .filter((deposit) => deposit.cycleId === targetCycleId && deposit.memberId === memberId)
      .reduce((sum, deposit) => sum + deposit.amount, 0);
    const nextDepositBalance = previousDepositBalance + amount;

    const { data, error } = await supabase
      .from('cycle_deposits')
      .insert([{
        member_id: memberId,
        cycle_id: targetCycleId,
        amount,
        note: note ?? null,
        user_id: userId,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding deposit:', error);
      return;
    }

    setAllDeposits((prev) => [...prev, {
      id: data.id,
      cycleId: data.cycle_id,
      memberId: data.member_id,
      amount: Number(data.amount),
      note: data.note ?? undefined,
      createdAt: data.created_at,
    }]);

    await recordChangelog({
      cycleId: targetCycleId,
      entityType: 'deposit',
      entityId: data.id,
      action: 'update',
      title: `Updated deposit for ${memberName}`,
      changes: [
        buildSnapshotChange('member', 'Member', memberName),
        buildUpdateChange('deposit_balance', 'Deposit Balance', previousDepositBalance, nextDepositBalance)!,
        buildSnapshotChange('transaction_amount', 'Transaction', Number(data.amount)),
        ...(data.note ? [buildSnapshotChange('note', 'Note', data.note)] : []),
      ],
    });
  };

  const saveMealLogs = async (
    entries: Array<{ memberId: string; count: number }>,
    dateStr: string,
    cycleId?: string,
  ) => {
    if (!userId) return;

    const targetCycleId = getRequiredCycleId(cycleId);
    if (!targetCycleId) return;

    let nextMealLogs = [...allMealLogs];
    const mealLogChanges: ChangelogChange[] = [];

    for (const entry of entries) {
      const normalizedCount = Number.isNaN(entry.count) ? 0 : entry.count;
      const existingLog = nextMealLogs.find((log) => (
        log.memberId === entry.memberId && log.date === dateStr && log.cycleId === targetCycleId
      ));

      if (existingLog) {
        if (existingLog.count === normalizedCount) {
          continue;
        }

        if (normalizedCount === 0) {
          const { error } = await supabase
            .from('meal_logs')
            .delete()
            .eq('id', existingLog.id)
            .eq('user_id', userId);

          if (error) {
            console.error('Error deleting meal log:', error);
            return;
          }

          nextMealLogs = nextMealLogs.filter((log) => log.id !== existingLog.id);
          mealLogChanges.push({
            field: `member:${entry.memberId}`,
            label: getMemberName(entry.memberId, targetCycleId),
            from: existingLog.count,
            to: 0,
          });
          continue;
        }

        const { error } = await supabase
          .from('meal_logs')
          .update({ count: normalizedCount })
          .eq('id', existingLog.id)
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating meal log:', error);
          return;
        }

        nextMealLogs = nextMealLogs.map((log) => (
          log.id === existingLog.id ? { ...log, count: normalizedCount } : log
        ));
        mealLogChanges.push({
          field: `member:${entry.memberId}`,
          label: getMemberName(entry.memberId, targetCycleId),
          from: existingLog.count,
          to: normalizedCount,
        });
        continue;
      }

      if (normalizedCount <= 0) {
        continue;
      }

      const { data, error } = await supabase
        .from('meal_logs')
        .insert([{
          member_id: entry.memberId,
          cycle_id: targetCycleId,
          date: dateStr,
          count: normalizedCount,
          user_id: userId,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating meal log:', error);
        return;
      }

      nextMealLogs = [...nextMealLogs, {
        id: data.id,
        cycleId: data.cycle_id,
        memberId: data.member_id,
        date: data.date,
        count: Number(data.count),
      }];
      mealLogChanges.push({
        field: `member:${entry.memberId}`,
        label: getMemberName(entry.memberId, targetCycleId),
        from: 0,
        to: Number(data.count),
      });
    }

    if (mealLogChanges.length === 0) {
      return;
    }

    setAllMealLogs(nextMealLogs);

    const sortedMealLogChanges = mealLogChanges.sort((left, right) => left.label.localeCompare(right.label));
    await recordChangelog({
      cycleId: targetCycleId,
      entityType: 'meal_log',
      entityId: targetCycleId,
      action: getMealLogAction(sortedMealLogChanges),
      title: `Saved meal log for ${sortedMealLogChanges.length} ${sortedMealLogChanges.length === 1 ? 'member' : 'members'}`,
      changes: [
        buildSnapshotChange('date', 'Date', dateStr),
        buildSnapshotChange('members_changed', 'Members Changed', sortedMealLogChanges.length),
        ...sortedMealLogChanges,
      ],
    });
  };

  const logMeal = async (memberId: string, count: number, dateStr: string, cycleId?: string) => {
    await saveMealLogs([{ memberId, count }], dateStr, cycleId);
  };

  const renameActiveCycle = async (name: string) => {
    if (!userId || !activeCycle) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Cycle name is required.');
    }

    if (trimmedName === activeCycle.name) {
      return;
    }

    const duplicateCycle = cycles.find((cycle) => (
      cycle.id !== activeCycle.id &&
      cycle.name.trim().toLowerCase() === trimmedName.toLowerCase()
    ));

    if (duplicateCycle) {
      throw new Error('A cycle with this name already exists.');
    }

    const { error } = await supabase
      .from('cycles')
      .update({ name: trimmedName })
      .eq('id', activeCycle.id)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Error renaming active cycle:', error);
      if (error.code === '23505') {
        throw new Error('A cycle with this name already exists.');
      }
      throw new Error('Unable to rename the current cycle right now.');
    }

    setCycles((prev) => prev.map((cycle) => (
      cycle.id === activeCycle.id ? { ...cycle, name: trimmedName } : cycle
    )));
  };

  const closeActiveCycle = async () => {
    if (!userId || !activeCycle) return;
    if (pendingCycle) {
      throw new Error('Finish the pending cycle settlement before closing another cycle.');
    }

    const snapshot = memberRoster.map((member) => ({
      id: member.id,
      name: member.name,
      avatar: member.avatar,
    }));

    const now = new Date().toISOString();
    const nextCycleName = generateUniqueCycleName(now, cycles);

    const { error: updateError } = await supabase
      .from('cycles')
      .update({
        status: 'pending',
        closed_at: now,
        members_snapshot: snapshot,
      })
      .eq('id', activeCycle.id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error moving cycle to pending:', updateError);
      return;
    }

    const { data: nextActive, error: createError } = await supabase
      .from('cycles')
      .insert([{
        name: nextCycleName,
        status: 'active',
        user_id: userId,
        started_at: now,
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating new active cycle:', createError);
      return;
    }

    setCycles((prev) => [
      {
        id: nextActive.id,
        name: nextActive.name ?? nextCycleName,
        status: nextActive.status as CycleStatus,
        startedAt: nextActive.started_at,
        closedAt: nextActive.closed_at,
        finalizedAt: nextActive.finalized_at,
        membersSnapshot: nextActive.members_snapshot,
      },
      ...prev.map((cycle) => (
        cycle.id === activeCycle.id
          ? { ...cycle, status: 'pending' as CycleStatus, closedAt: now, membersSnapshot: snapshot }
          : cycle
      )),
    ]);
  };

  const markCycleClosed = async (cycleId: string) => {
    if (!userId) return;

    const finalizedAt = new Date().toISOString();
    const { error } = await supabase
      .from('cycles')
      .update({
        status: 'closed',
        finalized_at: finalizedAt,
      })
      .eq('id', cycleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error closing pending cycle:', error);
      return;
    }

    const { error: changelogError } = await supabase
      .from('changelog_entries')
      .delete()
      .eq('cycle_id', cycleId)
      .eq('user_id', userId);

    if (changelogError) {
      console.error('Error deleting cycle changelog entries:', changelogError);
      return;
    }

    setCycles((prev) => prev.map((cycle) => (
      cycle.id === cycleId ? { ...cycle, status: 'closed', finalizedAt } : cycle
    )));
    setAllChangelogEntries((prev) => prev.filter((entry) => entry.cycleId !== cycleId));
  };

  const deleteCycle = async (cycleId: string) => {
    if (!userId) return;

    const targetCycle = cycles.find((cycle) => cycle.id === cycleId);
    if (!targetCycle || targetCycle.status !== 'closed') {
      return;
    }

    const { error } = await supabase
      .from('cycles')
      .delete()
      .eq('id', cycleId)
      .eq('user_id', userId)
      .eq('status', 'closed');

    if (error) {
      console.error('Error deleting closed cycle:', error);
      return;
    }

    setCycles((prev) => prev.filter((cycle) => cycle.id !== cycleId));
    setAllExpenses((prev) => prev.filter((expense) => expense.cycleId !== cycleId));
    setAllMealLogs((prev) => prev.filter((log) => log.cycleId !== cycleId));
    setAllDeposits((prev) => prev.filter((deposit) => deposit.cycleId !== cycleId));
    setAllChangelogEntries((prev) => prev.filter((entry) => entry.cycleId !== cycleId));
  };

  const activeDetails = activeCycle ? getCycleDetails(activeCycle.id) : null;

  const members = activeDetails?.members ?? [];
  const expenses = activeDetails?.expenses ?? [];
  const mealLogs = activeDetails?.mealLogs ?? [];
  const stats = activeDetails?.stats ?? {
    totalDeposits: 0,
    totalMealExpenses: 0,
    totalFixedExpenses: 0,
    totalMealsConsumed: 0,
    currentMealRate: 0,
    fixedCostPerMember: 0,
    remainingCash: 0,
  };

  const getMemberStats = (memberId: string, cycleId?: string) => {
    const targetCycleId = getRequiredCycleId(cycleId);
    if (!targetCycleId) {
      return { mealCost: 0, fixedCost: 0, totalCost: 0, balance: 0, mealsEaten: 0 };
    }

    const details = getCycleDetails(targetCycleId);
    const member = details?.members.find((entry) => entry.id === memberId);

    if (!member) {
      return { mealCost: 0, fixedCost: 0, totalCost: 0, balance: 0, mealsEaten: 0 };
    }

    return {
      mealCost: member.mealCost,
      fixedCost: member.fixedCost,
      totalCost: member.totalCost,
      balance: member.balance,
      mealsEaten: member.mealsEaten,
    };
  };

  return (
    <MealContext.Provider
      value={{
        members,
        expenses,
        mealLogs,
        cycles,
        activeCycleChangelogEntries,
        pendingCycleChangelogEntries,
        activeCycle,
        pendingCycle,
        loading,
        addMember,
        updateMember,
        removeMember,
        addExpense,
        updateExpense,
        deleteExpense,
        addDeposit,
        saveMealLogs,
        logMeal,
        renameActiveCycle,
        closeActiveCycle,
        markCycleClosed,
        deleteCycle,
        stats,
        getMemberStats,
        getCycleDetails,
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMeal() {
  const context = useContext(MealContext);
  if (context === undefined) {
    throw new Error('useMeal must be used within a MealProvider');
  }
  return context;
}
