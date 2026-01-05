import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Coffee, LogIn, LogOut, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PunchType = 'entry' | 'lunch_exit' | 'lunch_return' | 'exit';

interface TimeRecord {
  id: string;
  user_id: string;
  record_date: string;
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
}

const punchConfig: Record<PunchType, { label: string; icon: React.ReactNode; expectedHour: number; column: keyof TimeRecord }> = {
  entry: { label: "Entrada", icon: <LogIn className="h-5 w-5" />, expectedHour: 8, column: 'entry_time' },
  lunch_exit: { label: "Saída Almoço", icon: <Coffee className="h-5 w-5" />, expectedHour: 12, column: 'lunch_exit_time' },
  lunch_return: { label: "Retorno Almoço", icon: <Sun className="h-5 w-5" />, expectedHour: 13, column: 'lunch_return_time' },
  exit: { label: "Saída", icon: <LogOut className="h-5 w-5" />, expectedHour: 18, column: 'exit_time' },
};

export default function TimeClock() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchTodayRecord();
    }
  }, [user]);

  const fetchTodayRecord = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('record_date', today)
      .maybeSingle();

    if (error) {
      console.error('Error fetching time record:', error);
    } else {
      setTodayRecord(data);
    }
    setLoading(false);
  };

  const handlePunch = async (type: PunchType) => {
    if (!user) return;

    const now = new Date().toISOString();
    const today = format(new Date(), 'yyyy-MM-dd');
    const column = punchConfig[type].column;

    try {
      if (todayRecord) {
        // Update existing record
        const { error } = await supabase
          .from('time_records')
          .update({ [column]: now })
          .eq('id', todayRecord.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            record_date: today,
            [column]: now,
          });

        if (error) throw error;
      }

      toast.success(`${punchConfig[type].label} registrada com sucesso!`);
      fetchTodayRecord();
    } catch (error: any) {
      console.error('Error punching:', error);
      toast.error(`Erro ao registrar ${punchConfig[type].label.toLowerCase()}`);
    }
  };

  const getNextPunch = (): PunchType | null => {
    if (!todayRecord?.entry_time) return 'entry';
    if (!todayRecord?.lunch_exit_time) return 'lunch_exit';
    if (!todayRecord?.lunch_return_time) return 'lunch_return';
    if (!todayRecord?.exit_time) return 'exit';
    return null;
  };

  const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    return format(new Date(time), 'HH:mm');
  };

  const nextPunch = getNextPunch();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ponto Eletrônico</h1>
        <p className="text-muted-foreground">
          Registre sua presença nos horários estabelecidos
        </p>
      </div>

      {/* Current Time Display */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-4">
            <Clock className="h-12 w-12 text-primary" />
            <div className="text-center">
              <p className="text-5xl font-bold font-mono">
                {format(currentTime, 'HH:mm:ss')}
              </p>
              <p className="text-muted-foreground mt-1">
                {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Punch Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(punchConfig) as PunchType[]).map((type) => {
          const config = punchConfig[type];
          const time = todayRecord?.[config.column as keyof TimeRecord] as string | null;
          const isPunched = !!time;
          const isNext = nextPunch === type;

          return (
            <Card 
              key={type} 
              className={`transition-all ${isNext ? 'ring-2 ring-primary shadow-lg' : ''} ${isPunched ? 'bg-muted/50' : ''}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </CardTitle>
                  <Badge variant={isPunched ? "default" : "secondary"}>
                    {config.expectedHour}:00
                  </Badge>
                </div>
                <CardDescription>
                  {isPunched ? 'Registrado' : 'Pendente'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-3xl font-mono font-bold text-center">
                    {formatTime(time)}
                  </p>
                  <Button
                    onClick={() => handlePunch(type)}
                    disabled={isPunched}
                    className="w-full"
                    variant={isNext ? "default" : "outline"}
                  >
                    {isPunched ? 'Registrado ✓' : 'Bater Ponto'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Summary */}
      {todayRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Resumo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Entrada</p>
                <p className="text-lg font-semibold">{formatTime(todayRecord.entry_time)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saída Almoço</p>
                <p className="text-lg font-semibold">{formatTime(todayRecord.lunch_exit_time)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retorno Almoço</p>
                <p className="text-lg font-semibold">{formatTime(todayRecord.lunch_return_time)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saída</p>
                <p className="text-lg font-semibold">{formatTime(todayRecord.exit_time)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {nextPunch === null && (
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <p className="text-center text-green-700 dark:text-green-400 font-medium">
              ✅ Todos os pontos do dia foram registrados!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
