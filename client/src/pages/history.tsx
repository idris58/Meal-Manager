import { useEffect, useMemo, useState } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { eachDayOfInterval, format, max, min, parseISO, startOfDay } from 'date-fns';
import { Archive, ChevronDown, Pencil, Plus, ScrollText, ShoppingBag, Trash2, Wallet, Zap } from 'lucide-react';
import { Link } from 'wouter';

import { useMeal, type CycleDetails, type Expense } from '@/lib/meal-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

function formatCurrency(amount: number) {
  return `৳${amount.toFixed(2)}`;
}

function formatBalance(amount: number) {
  return `${amount >= 0 ? '+' : '-'}${Math.round(Math.abs(amount))}`;
}

function formatMealCount(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return rounded.toString();
}

function SettlementForm({
  cycleId,
  memberId,
  memberName,
  onClose,
}: {
  cycleId: string;
  memberId: string;
  memberName: string;
  onClose: () => void;
}) {
  const { addDeposit } = useMeal();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed === 0) return;
    await addDeposit(memberId, parsed, cycleId, note || undefined);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Positive amount means this member paid money to the meal. Negative amount means the manager returned money to this member.
      </p>
      <div className="space-y-2">
        <label className="text-sm font-medium">Amount</label>
        <Input type="number" placeholder="e.g. 300 or -300" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Note</label>
        <Input placeholder={`Settlement for ${memberName}`} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <Button type="submit" className="w-full">Save Settlement</Button>
    </form>
  );
}

function PendingExpenseEditor({
  cycleId,
  expense,
  onClose,
}: {
  cycleId: string;
  expense?: Expense | null;
  onClose: () => void;
}) {
  const { addExpense, updateExpense, deleteExpense } = useMeal();
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [type, setType] = useState<'meal' | 'fixed'>(expense?.type ?? 'meal');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? '');
  const [date, setDate] = useState<Date>(expense ? new Date(expense.date) : new Date());

  useEffect(() => {
    setDescription(expense?.description ?? '');
    setAmount(expense ? String(expense.amount) : '');
    setType(expense?.type ?? 'meal');
    setPaidBy(expense?.paidBy ?? '');
    setDate(expense ? new Date(expense.date) : new Date());
  }, [expense]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!description.trim() || !paidBy.trim() || isNaN(parsedAmount) || parsedAmount === 0) return;

    if (expense) {
      await updateExpense(expense.id, {
        description: description.trim(),
        amount: parsedAmount,
        type,
        paidBy: paidBy.trim(),
        date: format(date, 'yyyy-MM-dd'),
      });
    } else {
      await addExpense(parsedAmount, description.trim(), type, paidBy.trim(), cycleId, format(date, 'yyyy-MM-dd'));
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!expense) return;
    await deleteExpense(expense.id);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Expense Type</label>
        <Select value={type} onValueChange={(value: 'meal' | 'fixed') => setType(value)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="meal">Meal (Grocery/Food)</SelectItem>
            <SelectItem value="fixed">Fixed (Bills/Utilities)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Rice, WiFi bill" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
              <span className="mr-2 inline-block h-4 w-4" />
              {date ? format(date, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[18rem] rounded-xl border bg-card p-0 shadow-2xl" align="center">
            <Calendar mode="single" selected={date} onSelect={(nextDate) => nextDate && setDate(nextDate)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Amount</label>
        <Input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="100"
        />
        <p className="text-xs text-muted-foreground">
          Negative amounts are allowed here for pending-cycle corrections.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Who Shopped?</label>
        <Input value={paidBy} onChange={(event) => setPaidBy(event.target.value)} placeholder="Shopper name" />
      </div>

      {expense ? (
        <div className="flex gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the expense from this pending cycle.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button type="submit" className="flex-1">Save Changes</Button>
        </div>
      ) : (
        <Button type="submit" className="w-full">Add Expense</Button>
      )}
    </form>
  );
}

function PendingMealEditor({
  cycleId,
  details,
  initialDate,
  onClose,
}: {
  cycleId: string;
  details: CycleDetails;
  initialDate?: Date;
  onClose: () => void;
}) {
  const { saveMealLogs } = useMeal();
  const [date, setDate] = useState<Date>(initialDate ?? new Date());
  const [mealCounts, setMealCounts] = useState<Record<string, string>>(
    Object.fromEntries(details.members.map((member) => [member.id, '0'])),
  );

  useEffect(() => {
    setDate(initialDate ?? new Date());
  }, [initialDate]);

  useEffect(() => {
    const shortDate = format(date, 'yyyy-MM-dd');
    const existingLogs = Object.fromEntries(
      details.members.map((member) => {
        const log = details.mealLogs.find((entry) => entry.memberId === member.id && entry.date === shortDate);
        return [member.id, log ? String(log.count) : '0'];
      }),
    );
    setMealCounts(existingLogs);
  }, [date, details]);

  const updateCount = (memberId: string, delta: number) => {
    setMealCounts((prev) => {
      const nextValue = Math.max(0, parseFloat(prev[memberId] || '0') + delta);
      return { ...prev, [memberId]: String(nextValue) };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const dateStr = format(date, 'yyyy-MM-dd');
    await saveMealLogs(
      Object.entries(mealCounts).map(([memberId, count]) => ({
        memberId,
        count: parseFloat(count),
      })),
      dateStr,
      cycleId,
    );
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">{format(date, 'PPP')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-[18rem] rounded-xl border bg-card p-0 shadow-2xl" align="center">
            <Calendar mode="single" selected={date} onSelect={(nextDate) => nextDate && setDate(nextDate)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-2">
        {details.members.map((member) => (
          <div key={member.id} className="flex items-center justify-between rounded-lg border bg-secondary/20 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 text-xs"><AvatarFallback>{member.avatar}</AvatarFallback></Avatar>
              <span className="text-sm font-medium">{member.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCount(member.id, -0.5)}>-</Button>
              <Input className="h-8 w-16 px-1 text-center font-bold" value={mealCounts[member.id] ?? '0'} onChange={(event) => setMealCounts((prev) => ({ ...prev, [member.id]: event.target.value }))} />
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCount(member.id, 0.5)}>+</Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full">Save Meal Log</Button>
    </form>
  );
}

function PendingCycleCard({ details }: { details: CycleDetails }) {
  const { markCycleClosed } = useMeal();
  const [depositMember, setDepositMember] = useState<{ id: string; name: string } | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [mealDate, setMealDate] = useState<Date | undefined>(undefined);
  const remainingBalance =
    details.stats.totalDeposits -
    details.stats.totalMealExpenses -
    details.stats.totalFixedExpenses;
  const roundedRemainingBalance = Math.round(remainingBalance);
  const managerShouldGet = details.members.reduce((sum, member) => {
    if (member.balance >= 0) return sum;
    return sum + Math.abs(Math.round(member.balance));
  }, 0);
  const managerShouldGive = details.members.reduce((sum, member) => {
    if (member.balance <= 0) return sum;
    return sum + Math.round(member.balance);
  }, 0);
  const managerGetPlusRemaining = managerShouldGet + roundedRemainingBalance;
  const settlementMismatch = managerShouldGive - managerGetPlusRemaining;
  const isSettlementMatched = settlementMismatch === 0;
  const signedRemainingBalanceText =
    roundedRemainingBalance >= 0
      ? formatCurrency(roundedRemainingBalance)
      : `(-${formatCurrency(Math.abs(roundedRemainingBalance))})`;
  const settlementFormulaText =
    `${formatCurrency(managerShouldGet)} + ${signedRemainingBalanceText}`;
  const memberMealTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const member of details.members) {
      totals.set(member.id, 0);
    }

    for (const log of details.mealLogs) {
      totals.set(log.memberId, (totals.get(log.memberId) ?? 0) + log.count);
    }

    return totals;
  }, [details.mealLogs, details.members]);

  const days = useMemo(() => {
    if (details.mealLogs.length === 0) {
      return [startOfDay(new Date(details.cycle.closedAt || details.cycle.startedAt))];
    }
    const logDates = details.mealLogs.map((log) => startOfDay(parseISO(log.date)));
    return eachDayOfInterval({ start: min(logDates), end: max(logDates) }).reverse();
  }, [details]);

  return (
    <AccordionItem value={details.cycle.id} className="rounded-lg border bg-card px-4">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="text-left">
            <p className="font-bold">{details.cycle.name}</p>
            <p className="text-sm text-muted-foreground">
              Closed: {format(new Date(details.cycle.closedAt || details.cycle.startedAt), 'PPP')} • {details.members.length} Members • {formatMealCount(details.stats.totalMealsConsumed)} Meals • Settlement still editable
            </p>
          </div>
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 pb-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard title="Total Deposits" value={formatCurrency(details.stats.totalDeposits)} />
          <StatCard title="Meal Expense" value={formatCurrency(details.stats.totalMealExpenses)} />
          <StatCard title="Fixed Expense" value={formatCurrency(details.stats.totalFixedExpenses)} />
          <StatCard
            title="Remaining Balance"
            value={`${remainingBalance >= 0 ? '' : '-'}${formatCurrency(Math.abs(remainingBalance))}`}
            tone={remainingBalance >= 0 ? 'positive' : 'negative'}
          />
          <StatCard title="Meal Rate" value={formatCurrency(details.stats.currentMealRate)} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="gap-2" onClick={() => { setEditingExpense(null); setExpenseDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add Expense Correction
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setMealDate(undefined); setMealDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add Meal Correction
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Mark Cycle Closed</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lock this pending cycle?</AlertDialogTitle>
                <AlertDialogDescription>
                  After this, the cycle will become read-only and settlement edits will stop.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => markCycleClosed(details.cycle.id)}>Yes, Mark Closed</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <section className="space-y-3">
          <h3 className="font-semibold">Member Settlement Summary</h3>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Deposit - Fixed</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Total Meals</TableHead>
                  <TableHead className="text-right">Meal Cost</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 text-xs"><AvatarFallback>{member.avatar}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <span className="block truncate font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground sm:hidden whitespace-nowrap">{formatMealCount(member.mealsEaten)} meals</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(member.deposit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.deposit - member.fixedCost)}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{formatMealCount(member.mealsEaten)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.mealCost)}</TableCell>
                    <TableCell className={cn('text-right font-bold', member.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {formatBalance(member.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setDepositMember({ id: member.id, name: member.name })}>
                        <Wallet className="h-4 w-4" />
                        Settle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Card>
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Settlement Check</p>
                  <p className="text-xs text-muted-foreground">
                    Confirms whether the pending-cycle settlement math is balanced.
                  </p>
                </div>
                <p
                  className={cn(
                    'inline-flex items-center self-start rounded-full px-2.5 py-1 text-sm font-semibold',
                    isSettlementMatched
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700',
                  )}
                >
                  {isSettlementMatched ? 'Calculation matched' : 'Calculation mismatch'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Manager Get + Remaining
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {formatCurrency(managerGetPlusRemaining)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settlementFormulaText}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Manager Give</p>
                  <p className="mt-1 text-xl font-bold">
                    {formatCurrency(managerShouldGive)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Total of positive member balances
                  </p>
                </div>
              </div>
              {!isSettlementMatched ? (
                <p className="text-sm font-medium text-red-600">
                  Mismatch: {formatCurrency(Math.abs(settlementMismatch))}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Expenses</h3>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="meal">Meals</TabsTrigger>
              <TabsTrigger value="fixed">Fixed</TabsTrigger>
            </TabsList>
            {(['all', 'meal', 'fixed'] as const).map((tab) => {
              const expenses =
                tab === 'all'
                  ? [...details.expenses]
                  : details.expenses.filter((expense) => expense.type === tab);
              const useScrollableExpenseList = expenses.length > 8;

              return (
                <TabsContent key={tab} value={tab} className="m-0">
                  <div className="space-y-3">
                    {expenses.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No expenses found.
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div
                          className={cn(
                            'space-y-3',
                            useScrollableExpenseList &&
                              'max-h-[420px] overflow-y-auto rounded-lg border border-dashed bg-muted/10 p-2 sm:max-h-[460px] md:max-h-[540px]',
                          )}
                        >
                          {expenses.map((expense) => (
                            <div key={expense.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                              <div className="flex items-center gap-4">
                                <div
                                  className={cn(
                                    'rounded-full p-2',
                                    expense.type === 'meal'
                                      ? 'bg-emerald-100 text-emerald-600'
                                      : 'bg-slate-100 text-slate-600',
                                  )}
                                >
                                  {expense.type === 'meal' ? (
                                    <ShoppingBag className="h-5 w-5" />
                                  ) : (
                                    <Zap className="h-5 w-5" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{expense.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(expense.date), 'MMM d, yyyy')} • Paid by {expense.paidBy}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-bold">{formatCurrency(expense.amount)}</p>
                                  <Badge variant="secondary" className="text-[10px] uppercase">
                                    {expense.type}
                                  </Badge>
                                </div>
                                <Button variant="outline" size="icon" onClick={() => { setEditingExpense(expense); setExpenseDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Meal Logs</h3>
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="max-h-[420px] overflow-auto overscroll-x-contain [scrollbar-gutter:stable_both-edges]">
              <table className="min-w-max w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20 bg-card">
                  <tr className="border-b">
                    <th className="sticky left-0 z-30 min-w-[84px] border-r bg-card p-3 text-left text-xs font-bold sm:min-w-[96px] md:min-w-[112px] md:p-4 md:text-sm">Date</th>
                    {details.members.map((member) => (
                      <th key={member.id} className="min-w-[72px] border-r bg-card p-1.5 text-center text-[9px] font-bold sm:min-w-[84px] sm:text-[10px] md:min-w-[100px] md:p-2 md:text-xs">{member.name.split(' ')[0]}</th>
                    ))}
                    <th className="min-w-[64px] bg-card p-3 text-right text-xs font-bold sm:min-w-[72px] md:min-w-[80px] md:p-4 md:text-sm">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayLogs = details.mealLogs.filter((log) => log.date === dateStr);
                    const total = dayLogs.reduce((sum, log) => sum + log.count, 0);

                    return (
                      <tr key={dateStr} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => { setMealDate(day); setMealDialogOpen(true); }}>
                        <td className="sticky left-0 border-r bg-card p-3 font-medium md:p-4">{format(day, 'dd MMM')}</td>
                        {details.members.map((member) => {
                          const log = dayLogs.find((entry) => entry.memberId === member.id);
                          return <td key={member.id} className="border-r p-2.5 text-center text-xs sm:p-3 sm:text-sm md:p-4">{log ? formatMealCount(log.count) : '-'}</td>;
                        })}
                        <td className="p-3 text-right font-bold text-emerald-600 md:p-4">{total > 0 ? formatMealCount(total) : '-'}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 bg-secondary/20">
                    <td className="sticky left-0 z-20 min-w-[84px] whitespace-nowrap border-r bg-card p-3 font-bold sm:min-w-[96px] md:min-w-[112px] md:p-4">Total</td>
                    {details.members.map((member) => (
                      <td
                        key={member.id}
                        className="border-r p-2.5 text-center font-bold text-emerald-700 sm:p-3 sm:text-sm md:p-4"
                      >
                        {formatMealCount(memberMealTotals.get(member.id) ?? 0)}
                      </td>
                    ))}
                    <td className="bg-secondary/20 p-3 text-right font-bold text-emerald-700 md:p-4">
                      {formatMealCount(details.stats.totalMealsConsumed)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <Dialog open={!!depositMember} onOpenChange={(open) => !open && setDepositMember(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Settlement</DialogTitle></DialogHeader>
            {depositMember ? (
              <SettlementForm cycleId={details.cycle.id} memberId={depositMember.id} memberName={depositMember.name} onClose={() => setDepositMember(null)} />
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense Correction'}</DialogTitle></DialogHeader>
            <PendingExpenseEditor
              cycleId={details.cycle.id}
              expense={editingExpense}
              onClose={() => {
                setExpenseDialogOpen(false);
                setEditingExpense(null);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={mealDialogOpen} onOpenChange={setMealDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{mealDate ? `Edit Meals for ${format(mealDate, 'PPP')}` : 'Add Meal Correction'}</DialogTitle></DialogHeader>
            <PendingMealEditor
              cycleId={details.cycle.id}
              details={details}
              initialDate={mealDate}
              onClose={() => {
                setMealDialogOpen(false);
                setMealDate(undefined);
              }}
            />
          </DialogContent>
        </Dialog>
      </AccordionContent>
    </AccordionItem>
  );
}

function ClosedCycleCard({ details, isExpanded }: { details: CycleDetails; isExpanded: boolean }) {
  const { deleteCycle } = useMeal();

  return (
    <AccordionItem value={details.cycle.id} className="rounded-lg border bg-card px-4">
      <div className="flex items-center justify-between gap-4 py-4">
        <AccordionPrimitive.Header className="min-w-0 flex-1">
          <AccordionPrimitive.Trigger className="flex w-full items-center justify-between text-left text-sm font-medium transition-all hover:no-underline [&[data-state=open]>svg]:rotate-180">
            <div className="text-left">
              <p className="font-bold">{details.cycle.name}</p>
              <p className="text-sm text-muted-foreground">Closed: {format(new Date(details.cycle.finalizedAt || details.cycle.closedAt || details.cycle.startedAt), 'PPP')} • {details.members.length} Members • {formatMealCount(details.stats.totalMealsConsumed)} Meals</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <div className="flex shrink-0 items-center gap-2">
          {isExpanded ? (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 sm:hidden"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this closed cycle?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the closed cycle and all of its linked expenses, meal logs, deposits, and changelog records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteCycle(details.cycle.id)}>
                      Yes, Delete Cycle
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 sm:inline-flex"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Cycle
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this closed cycle?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the closed cycle and all of its linked expenses, meal logs, deposits, and changelog records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteCycle(details.cycle.id)}>
                      Yes, Delete Cycle
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
          <Badge variant="secondary">Closed</Badge>
        </div>
      </div>
      <AccordionContent className="space-y-4 pb-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard title="Total Deposits" value={formatCurrency(details.stats.totalDeposits)} />
          <StatCard title="Meal Expense" value={formatCurrency(details.stats.totalMealExpenses)} />
          <StatCard title="Fixed Expense" value={formatCurrency(details.stats.totalFixedExpenses)} />
          <StatCard title="Meal Rate" value={formatCurrency(details.stats.currentMealRate)} />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-center">Meals</TableHead>
                <TableHead className="text-center">Deposit</TableHead>
                <TableHead className="text-right">Final Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-center">{formatMealCount(member.mealsEaten)}</TableCell>
                  <TableCell className="text-center">{formatCurrency(member.deposit)}</TableCell>
                  <TableCell className={cn('text-right font-bold', member.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatBalance(member.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function StatCard({
  title,
  value,
  tone = 'default',
}: {
  title: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <div
      className={cn(
        'rounded-lg bg-secondary/30 p-3',
      )}
    >
      <p
        className={cn(
          'text-xs uppercase',
          tone === 'default' && 'text-muted-foreground',
          tone === 'positive' && 'text-emerald-700',
          tone === 'negative' && 'text-red-700',
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          'font-bold',
          tone === 'positive' && 'text-emerald-700',
          tone === 'negative' && 'text-red-700',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function HistoryPage() {
  const { cycles, getCycleDetails } = useMeal();
  const [openClosedCycleId, setOpenClosedCycleId] = useState('');

  const pendingCycles = cycles
    .filter((cycle) => cycle.status === 'pending')
    .map((cycle) => getCycleDetails(cycle.id))
    .filter((cycle): cycle is CycleDetails => Boolean(cycle));

  const closedCycles = cycles
    .filter((cycle) => cycle.status === 'closed')
    .map((cycle) => getCycleDetails(cycle.id))
    .filter((cycle): cycle is CycleDetails => Boolean(cycle));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">History</h1>
          <p className="text-sm text-muted-foreground">
            Pending cycles stay editable for settlement and corrections. Closed cycles are read-only.
          </p>
        </div>
        <Button variant="outline" size="icon" asChild title="View Changelog" aria-label="View Changelog">
          <Link href="/changelog">
            <ScrollText className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {pendingCycles.length === 0 && closedCycles.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <h2 className="mb-2 text-2xl font-bold font-heading">No Past Cycles</h2>
          <p>Close your first cycle to see settlement history here.</p>
        </div>
      ) : null}

      {pendingCycles.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">Pending Settlement</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            {pendingCycles.map((cycle) => <PendingCycleCard key={cycle.cycle.id} details={cycle} />)}
          </Accordion>
        </section>
      ) : null}

      {closedCycles.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-bold">Closed Cycles</h2>
          </div>
          <Accordion
            type="single"
            collapsible
            className="space-y-4"
            value={openClosedCycleId}
            onValueChange={setOpenClosedCycleId}
          >
            {closedCycles.map((cycle) => (
              <ClosedCycleCard
                key={cycle.cycle.id}
                details={cycle}
                isExpanded={openClosedCycleId === cycle.cycle.id}
              />
            ))}
          </Accordion>
        </section>
      ) : null}
    </div>
  );
}

