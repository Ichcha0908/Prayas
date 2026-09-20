import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Fuel, MapPin } from 'lucide-react';
import { Logo } from '@/components/layout/AppShell';
import { Card } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { cn } from '@/lib/cn';
import fuelPriceByCity from '@/data/fuel-price-by-city.json';

/**
 * The app's entry gate. Not a real login — this product explicitly rules out
 * fake credentials (see the README's ethics section) — it asks the one thing
 * the demo genuinely needs: which city's real weather and fuel price should
 * drive the forecast. The four choices are exactly the cities PPAC's daily
 * fuel-price bulletin covers, so every price shown here is real and checked,
 * not a guess extended to a city with no source behind it.
 */
export function Login() {
  const { cities, selectCity } = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  function choose(cityId: string) {
    setPending(cityId);
    selectCity(cityId);
    // A short beat so the selected state is visible before the route change.
    setTimeout(() => navigate('/app'), 260);
  }

  const prices = (fuelPriceByCity as { cities: Record<string, { petrol_price_per_litre: number }> }).cities;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas bg-hero-glow px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl"
      >
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card className="p-6 sm:p-8">
          <div className="mb-7 text-center">
            <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-400/25 bg-brand-900/25">
              <MapPin className="h-5 w-5 text-brand-300" aria-hidden />
            </span>
            <h1 className="font-display text-xl font-700 tracking-tight text-ink sm:text-2xl">
              Where are you based?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
              Your city sets the real weather and real fuel price behind the forecast — everything else about your
              demo profile stays the same.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Select your city"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {cities.map((city, i) => {
              const petrol = prices[city.id]?.petrol_price_per_litre;
              const isPending = pending === city.id;
              return (
                <motion.button
                  key={city.id}
                  type="button"
                  role="radio"
                  aria-checked={isPending}
                  onClick={() => choose(city.id)}
                  disabled={pending !== null}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'focus-ring group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-150',
                    isPending
                      ? 'border-brand-400/70 bg-brand-900/30'
                      : 'border-canvas-line bg-canvas-raised hover:border-brand-400/40 hover:bg-canvas-hover',
                    pending !== null && !isPending && 'opacity-40',
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base font-600 text-ink">{city.label}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{city.zone}</p>
                    </div>
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                        isPending ? 'border-brand-400 bg-brand-500' : 'border-canvas-line bg-canvas-card',
                      )}
                    >
                      {isPending ? (
                        <Check className="h-3.5 w-3.5 text-white" aria-hidden />
                      ) : (
                        <ArrowRight
                          className="h-3 w-3 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      )}
                    </span>
                  </div>

                  {petrol ? (
                    <span className="mt-1 flex items-center gap-1.5 rounded-lg bg-canvas-hover px-2 py-1 text-2xs text-ink-muted">
                      <Fuel className="h-3 w-3" aria-hidden />
                      Petrol <span className="tnum font-600 text-ink-soft">₹{petrol.toFixed(2)}/L</span>
                      <span className="text-ink-faint">today</span>
                    </span>
                  ) : null}
                </motion.button>
              );
            })}
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
            Weather from Open-Meteo, fuel prices from PPAC (Ministry of Petroleum &amp; Natural Gas) — both real, both
            checked. Demo runs on synthetic income data; nothing here is a real account.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
