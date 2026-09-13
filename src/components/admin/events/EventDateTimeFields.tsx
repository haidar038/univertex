import { useState } from 'react';
import { CalendarIcon, Clock3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EventDateTimeFieldsProps {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    disabled?: boolean;
    onStartDateChange: (date: string) => void;
    onStartTimeChange: (time: string) => void;
    onEndDateChange: (date: string) => void;
    onEndTimeChange: (time: string) => void;
    startDateError?: string;
    startTimeError?: string;
    endDateError?: string;
    endTimeError?: string;
}

const emptyDate = 'yyyy-MM-dd';

export function EventDateTimeFields({
    startDate,
    startTime,
    endDate,
    endTime,
    disabled = false,
    onStartDateChange,
    onStartTimeChange,
    onEndDateChange,
    onEndTimeChange,
    startDateError,
    startTimeError,
    endDateError,
    endTimeError,
}: EventDateTimeFieldsProps) {
    const [openStart, setOpenStart] = useState(false);
    const [openEnd, setOpenEnd] = useState(false);
    const startCalendarDate = startDate ? parseISO(startDate) : undefined;
    const endCalendarDate = endDate ? parseISO(endDate) : undefined;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label>
                    Waktu Mulai <span className="text-destructive">*</span>
                </Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_118px]">
                    <Popover open={openStart} onOpenChange={setOpenStart} modal={true}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                className={cn(
                                    'justify-start text-left font-normal h-10',
                                    !startDate && 'text-muted-foreground',
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                <span>{startDate ? format(parseISO(startDate), 'dd MMM yyyy', { locale: id }) : 'Pilih tanggal'}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" side="bottom" className="w-auto p-0 z-[60]">
                            <Calendar
                                mode="single"
                                selected={startCalendarDate}
                                onSelect={(date) => {
                                    if (!date) return;
                                    onStartDateChange(format(date, emptyDate));
                                    setOpenStart(false);
                                }}

                            />
                        </PopoverContent>
                    </Popover>

                    <Input
                        type="time"
                        value={startTime}
                        onChange={(event) => onStartTimeChange(event.target.value)}
                        disabled={disabled}
                        className="h-10"
                        aria-label="Jam mulai"
                    />
                </div>
                {startDateError && <p className="text-sm text-destructive">{startDateError}</p>}
                {startTimeError && <p className="text-sm text-destructive">{startTimeError}</p>}
            </div>

            <div className="space-y-2">
                <Label>
                    Waktu Selesai <span className="text-destructive">*</span>
                </Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_118px]">
                    <Popover open={openEnd} onOpenChange={setOpenEnd} modal={true}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                className={cn(
                                    'justify-start text-left font-normal h-10',
                                    !endDate && 'text-muted-foreground',
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                <span>{endDate ? format(parseISO(endDate), 'dd MMM yyyy', { locale: id }) : 'Pilih tanggal'}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" side="bottom" className="w-auto p-0 z-[60]">
                            <Calendar
                                mode="single"
                                selected={endCalendarDate}
                                onSelect={(date) => {
                                    if (!date) return;
                                    onEndDateChange(format(date, emptyDate));
                                    setOpenEnd(false);
                                }}

                            />
                        </PopoverContent>
                    </Popover>

                    <div className="relative">
                        <Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="time"
                            value={endTime}
                            onChange={(event) => onEndTimeChange(event.target.value)}
                            disabled={disabled}
                            className="h-10 pl-9"
                            aria-label="Jam selesai"
                        />
                    </div>
                </div>
                {endDateError && <p className="text-sm text-destructive">{endDateError}</p>}
                {endTimeError && <p className="text-sm text-destructive">{endTimeError}</p>}
            </div>
        </div>
    );
}
