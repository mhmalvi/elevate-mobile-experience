import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import {
    Users,
    Plus,
    Phone,
    Briefcase,
    DollarSign,
    ArrowLeft,
    Edit,
    Trash2,
    HardHat,
    Loader2,
} from 'lucide-react';

interface Subcontractor {
    id: string;
    user_id: string;
    name: string;
    trade: string;
    phone?: string;
    email?: string;
    abn?: string;
    hourly_rate?: number;
    notes?: string;
    created_at: string;
    updated_at: string;
}

interface SubcontractorFormData {
    name: string;
    trade: string;
    phone: string;
    email: string;
    abn: string;
    hourly_rate: string;
    notes: string;
}

const initialFormData: SubcontractorFormData = {
    name: '',
    trade: '',
    phone: '',
    email: '',
    abn: '',
    hourly_rate: '',
    notes: '',
};

export default function Subcontractors() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<SubcontractorFormData>(initialFormData);

    useEffect(() => {
        if (user) {
            fetchSubcontractors();
        }
    }, [user]);

    const fetchSubcontractors = async () => {
        const { data, error } = await (supabase as any)
            .from('subcontractors')
            .select('*')
            .eq('user_id', user?.id)
            .order('name');

        if (error) {
            console.error('Error fetching subcontractors:', error);
        } else {
            setSubcontractors((data as Subcontractor[]) || []);
        }
        setLoading(false);
    };

    const filteredSubcontractors = subcontractors.filter(sub => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return (
            sub.name?.toLowerCase().includes(term) ||
            sub.trade?.toLowerCase().includes(term) ||
            sub.phone?.includes(term)
        );
    });

    const openAddDialog = () => {
        setEditingId(null);
        setForm(initialFormData);
        setDialogOpen(true);
    };

    const openEditDialog = (sub: Subcontractor) => {
        setEditingId(sub.id);
        setForm({
            name: sub.name || '',
            trade: sub.trade || '',
            phone: sub.phone || '',
            email: sub.email || '',
            abn: sub.abn || '',
            hourly_rate: sub.hourly_rate?.toString() || '',
            notes: sub.notes || '',
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!form.name.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }

        setSaving(true);

        const payload = {
            user_id: user.id,
            name: form.name.trim(),
            trade: form.trade.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            abn: form.abn.trim() || null,
            hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
        };

        if (editingId) {
            const { error } = await (supabase as any)
                .from('subcontractors')
                .update(payload)
                .eq('id', editingId);

            if (error) {
                toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Subcontractor updated' });
                setDialogOpen(false);
                fetchSubcontractors();
            }
        } else {
            const { error } = await (supabase as any).from('subcontractors').insert({
                ...payload,
                created_at: new Date().toISOString(),
            });

            if (error) {
                toast({ title: 'Error adding', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Subcontractor added! 🎉' });
                setDialogOpen(false);
                fetchSubcontractors();
            }
        }

        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        const { error } = await (supabase as any).from('subcontractors').delete().eq('id', id);

        if (error) {
            toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Subcontractor removed' });
            setSubcontractors(subcontractors.filter(s => s.id !== id));
        }
    };

    return (
        <MobileLayout>
            <div className="min-h-screen scrollbar-hide">
                {/* Hero Section */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                    <div className="relative px-4 pt-8 pb-6">
                        <button
                            onClick={() => navigate('/settings')}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">Back to Settings</span>
                        </button>

                        <div className="flex items-center gap-2 mb-1">
                            <HardHat className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Team</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">Subcontractors</h1>
                        <p className="text-muted-foreground mt-1">
                            {subcontractors.length} {subcontractors.length === 1 ? 'subcontractor' : 'subcontractors'} in your network
                        </p>

                        {/* Add Button */}
                        <div className="absolute top-8 right-4">
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <button
                                        onClick={openAddDialog}
                                        className="p-2.5 rounded-full bg-primary shadow-premium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
                                    >
                                        <Plus className="w-6 h-6 text-primary-foreground" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{editingId ? 'Edit Subcontractor' : 'Add Subcontractor'}</DialogTitle>
                                        <DialogDescription>
                                            {editingId ? 'Update details for this subcontractor.' : 'Add a new subcontractor to your network.'}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Name *</Label>
                                            <Input
                                                id="name"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                placeholder="John's Electrical"
                                                className="h-11"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="trade">Trade</Label>
                                            <Input
                                                id="trade"
                                                value={form.trade}
                                                onChange={(e) => setForm({ ...form, trade: e.target.value })}
                                                placeholder="Electrician, Plumber, etc."
                                                className="h-11"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="phone">Phone</Label>
                                                <Input
                                                    id="phone"
                                                    type="tel"
                                                    value={form.phone}
                                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                                    placeholder="0412 345 678"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                                                <Input
                                                    id="hourly_rate"
                                                    type="number"
                                                    step="0.01"
                                                    value={form.hourly_rate}
                                                    onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                                                    placeholder="85"
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                placeholder="john@email.com"
                                                className="h-11"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="abn">ABN</Label>
                                            <Input
                                                id="abn"
                                                value={form.abn}
                                                onChange={(e) => setForm({ ...form, abn: e.target.value })}
                                                placeholder="12 345 678 901"
                                                className="h-11"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="notes">Notes</Label>
                                            <Textarea
                                                id="notes"
                                                value={form.notes}
                                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                                placeholder="Any notes about this subcontractor..."
                                                rows={2}
                                            />
                                        </div>

                                        <DialogFooter>
                                            <Button type="submit" disabled={saving} className="w-full rounded-xl">
                                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                                {editingId ? 'Update' : 'Add Subcontractor'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-32 space-y-4">
                    {subcontractors.length > 0 && (
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Search subcontractors, trades..."
                        />
                    )}

                    {loading ? (
                        <ListSkeleton count={5} />
                    ) : filteredSubcontractors.length === 0 && search ? (
                        <EmptyState
                            icon={<Users className="w-8 h-8" />}
                            title="No matches found"
                            description={`No subcontractors matching "${search}".`}
                        />
                    ) : subcontractors.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                <HardHat className="w-7 h-7 text-primary" />
                            </div>
                            <p className="font-semibold text-foreground">No subcontractors yet!</p>
                            <p className="text-sm text-muted-foreground mt-1">Add subcontractors you work with</p>
                            <Button onClick={openAddDialog} className="mt-4 rounded-xl" size="sm">
                                <Plus className="w-4 h-4 mr-1.5" />
                                Add Subcontractor
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredSubcontractors.map((sub, index) => (
                                <div
                                    key={sub.id}
                                    className={cn(
                                        "p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50",
                                        "hover:bg-card hover:border-primary/20 hover:shadow-lg",
                                        "transition-all duration-300 animate-fade-in"
                                    )}
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                                                <span className="text-base font-bold text-primary">
                                                    {sub.name[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-foreground">{sub.name}</h3>
                                                {sub.trade && (
                                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{sub.trade}</span>
                                                    </div>
                                                )}
                                                {sub.hourly_rate && (
                                                    <div className="flex items-center gap-1.5 text-sm text-primary font-medium mt-0.5">
                                                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{formatCurrency(sub.hourly_rate)}/hr</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {sub.phone && (
                                                <a
                                                    href={`tel:${sub.phone}`}
                                                    className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Phone className="w-4 h-4 text-primary" />
                                                </a>
                                            )}
                                            <button
                                                onClick={() => openEditDialog(sub)}
                                                className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                                            >
                                                <Edit className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                                                        <Trash2 className="w-4 h-4 text-destructive/60" />
                                                    </button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete {sub.name}?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will remove the subcontractor from your network. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(sub.id)}
                                                            className="bg-destructive text-destructive-foreground rounded-xl"
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MobileLayout>
    );
}
