import React, { useEffect, useState } from 'react';
import { MatchdayEvent } from '../types/matchday';
import { MapPin, ShieldCheck, Thermometer, Dumbbell } from 'lucide-react';

interface AmbientViewProps {
  events: MatchdayEvent[];
}

export const AmbientView: React.FC<AmbientViewProps> = ({ events }) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }));
      setDateStr(
        now.toLocaleDateString('fi-FI', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const nextEvent = events[0];

  const getSportBadge = (event: MatchdayEvent) => {
    switch (event.sport) {
      case 'volleyball':
        return '🏐 Lentopallo';
      case 'basketball':
        return '🏀 Koripallo';
      case 'floorball':
        return '🏑 Salibandy';
      case 'football':
        return '⚽ Jalkapallo';
      case 'icehockey':
        return '🏒 Jääkiekko';
      case 'futsal':
        return '👟 Futsal';
      default:
        return event.isTraining ? '🏃‍♂️ Harjoitukset' : '🏅 Ottelu';
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white p-6 md:p-12 flex flex-col justify-between select-none">
      {/* Top Bar: Time & Kitchen Hub Status */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-4xl md:text-6xl font-black font-tabular tracking-tight">{timeStr}</div>
          <div className="text-sm md:text-lg text-emerald-400 capitalize font-medium mt-1">{dateStr}</div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs md:text-sm font-semibold uppercase tracking-wider">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Pelipäivä Hub</span>
        </div>
      </div>

      {/* Center Hero: Next Upcoming Match or Training */}
      {nextEvent ? (
        <div className="my-auto py-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs md:text-sm font-bold uppercase tracking-wider border border-emerald-500/30 mb-4">
            {nextEvent.isTraining ? (
              <>
                <Dumbbell className="w-4 h-4" />
                <span>Harjoitus • {getSportBadge(nextEvent)}</span>
              </>
            ) : (
              <span>{getSportBadge(nextEvent)} • Kickoff klo {new Date(nextEvent.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>

          {nextEvent.isTraining ? (
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight text-white">
              {nextEvent.title}
            </h1>
          ) : (
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight flex items-baseline gap-3 flex-wrap">
              <span>{nextEvent.homeTeam}</span>
              {nextEvent.awayTeam && (
                <>
                  <span className="text-zinc-500 font-normal text-xl md:text-3xl">vs</span>
                  <span>{nextEvent.awayTeam}</span>
                </>
              )}
            </h1>
          )}

          <div className="flex items-center gap-3 mt-4 text-base md:text-2xl text-zinc-300">
            <MapPin className="w-6 h-6 text-emerald-400" />
            <span>{nextEvent.venue.name}</span>
          </div>

          {/* Quick Glances: Weather & Departure */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-xs text-zinc-400 font-semibold mb-1">Suositeltu lähtöaika</div>
              <div className="text-2xl md:text-3xl font-black text-emerald-400 font-tabular">
                klo {nextEvent.briefing?.recommendedDepartureTime || '16:45'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {nextEvent.isTraining ? 'Kokoontuminen' : 'Alkulämpö'} klo {new Date(nextEvent.warmupTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-xs text-zinc-400 font-semibold mb-1">Sää & Alusta</div>
              <div className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
                <Thermometer className="w-6 h-6 text-emerald-400" />
                {nextEvent.weather?.temperatureC ?? 18}°C
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {nextEvent.venue.isIndoor ? 'Sisähalli (kuiva)' : 'Ulkoteconurmi'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-xs text-zinc-400 font-semibold mb-1">Varusteet</div>
              <div className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                {nextEvent.isTraining
                  ? 'Sisäpelikengät & Juomapullo'
                  : nextEvent.briefing?.gearAndPackingAdvice.footwear === 'AG_ARTIFICIAL_GRASS'
                  ? 'AG-Tekonurminapit'
                  : 'Sisäpelikengät'}
              </div>
              <div className="text-xs text-zinc-400 mt-1 truncate">
                {nextEvent.volunteerDuty || (nextEvent.isTraining ? 'Treenivarustus' : 'Ykköspeliasu')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="my-auto py-12 text-center text-zinc-500">
          <div className="text-3xl font-bold">Ei tulevia otteluita tai harjoituksia tänään</div>
          <div className="text-sm mt-2">Nauti vapaapäivästä tai tarkista kalenterin tuonti.</div>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-900 pt-4">
        <span>Tieliikennelaki 2020 • FMI Avoin Data • Torneopal / Liitot</span>
        <span>Päivittyy reaaliajassa</span>
      </div>
    </div>
  );
};
