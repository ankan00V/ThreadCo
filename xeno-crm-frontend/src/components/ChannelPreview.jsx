import React from 'react';
import { Check, CheckCheck, Image as ImageIcon, Star, ChevronLeft, MoreVertical } from 'lucide-react';

/**
 * Per-channel message preview.
 *
 * The four delivery channels are not interchangeable — they differ in length
 * budget, whether a subject line exists, whether emoji are safe, and what the
 * recipient's client actually renders. Showing one generic chat bubble for all
 * four hides exactly the differences a marketer needs to see before dispatch,
 * so each channel gets its own chrome and its own constraints.
 */

// GSM-03.38 is the 7-bit alphabet SMS uses. Anything outside it (including all
// emoji and most curly quotes) forces the whole message to UCS-2, which cuts
// the per-segment budget from 160 characters to 70.
const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà" +
  "^{}\\[~]|€"
);

export function smsStats(text) {
  const body = text || '';
  const unicode = [...body].some((ch) => !GSM7.has(ch));
  const perSegment = unicode ? 70 : 160;
  const perSegmentMulti = unicode ? 67 : 153;
  const length = [...body].length;
  const segments = length === 0 ? 0
    : length <= perSegment ? 1
    : Math.ceil(length / perSegmentMulti);
  return { length, segments, unicode, perSegment };
}

export const CHANNEL_LIMITS = {
  whatsapp: { body: 1024, label: 'WhatsApp template body' },
  sms:      { body: 160,  label: 'One SMS segment' },
  email:    { body: 5000, label: 'Email body' },
  rcs:      { body: 2000, label: 'RCS rich card' },
};

const render = (text, fallback) =>
  (text || fallback).replace(/\{\{\s*name\s*\}\}/gi, 'Alex');

function Empty({ note }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center px-6">
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

/* ── WhatsApp ─────────────────────────────────────────────────────────────
   Inbound business message: white bubble on the wallpaper, tail top-left,
   timestamp inside the bubble, and the quick-reply buttons WhatsApp renders
   under a template message. */
function WhatsAppPreview({ body }) {
  return (
    <div className="w-full max-w-[300px] rounded-[26px] overflow-hidden shadow-xl border-[6px] border-neutral-900 bg-neutral-900">
      <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center gap-2">
        <ChevronLeft size={16} className="opacity-80" />
        <div className="w-7 h-7 rounded-full bg-white/20 grid place-items-center text-[11px] font-bold">T</div>
        <div className="leading-tight">
          <div className="text-[12px] font-semibold flex items-center gap-1">
            ThreadCo
            <span className="w-3 h-3 rounded-full bg-[#25D366] grid place-items-center">
              <Check size={8} strokeWidth={4} className="text-[#075E54]" />
            </span>
          </div>
          <div className="text-[9px] opacity-80">business account</div>
        </div>
        <MoreVertical size={14} className="ml-auto opacity-80" />
      </div>

      <div className="bg-[#ECE5DD] px-3 py-4 min-h-[300px] flex flex-col gap-1.5">
        {body ? (
          <>
            <div className="self-start max-w-[92%] bg-white rounded-lg rounded-tl-none px-2.5 py-2 shadow-sm">
              <p className="text-[11.5px] leading-relaxed text-neutral-800 whitespace-pre-wrap break-words">
                {render(body)}
              </p>
              <div className="text-[9px] text-neutral-400 text-right mt-1">10:24</div>
            </div>
            <div className="self-start w-[92%] mt-0.5 space-y-1">
              <div className="bg-white rounded-lg py-1.5 text-center text-[11px] font-medium text-[#0a7cff] shadow-sm">
                Shop now
              </div>
            </div>
          </>
        ) : (
          <Empty note="Your WhatsApp template will render here." />
        )}
      </div>
    </div>
  );
}

/* ── SMS ──────────────────────────────────────────────────────────────────
   Plain text only. Indian A2P traffic sends from a 6-character alphanumeric
   header, and there is no rich formatting, no buttons and no read receipt. */
function SmsPreview({ body }) {
  const stats = smsStats(render(body, ''));
  return (
    <div className="w-full max-w-[300px] rounded-[26px] overflow-hidden shadow-xl border-[6px] border-neutral-900 bg-white">
      <div className="bg-neutral-100 border-b border-neutral-200 px-3 py-2.5 text-center">
        <div className="text-[12px] font-semibold text-neutral-900">TM-THRDCO</div>
        <div className="text-[9px] text-neutral-500">Text message · SMS</div>
      </div>

      <div className="px-3 py-4 min-h-[300px] bg-white">
        {body ? (
          <>
            <div className="text-center text-[9px] text-neutral-400 mb-3">Today 10:24</div>
            <div className="self-start max-w-[92%] bg-[#E9E9EB] rounded-2xl rounded-bl-md px-3 py-2">
              <p className="text-[11.5px] leading-relaxed text-neutral-900 whitespace-pre-wrap break-words">
                {render(body)}
              </p>
            </div>
            <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-200 px-2.5 py-2 space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-500">Characters</span>
                <span className={`font-mono font-semibold ${stats.segments > 1 ? 'text-amber-700' : 'text-neutral-800'}`}>
                  {stats.length}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-500">Billed segments</span>
                <span className={`font-mono font-semibold ${stats.segments > 1 ? 'text-amber-700' : 'text-neutral-800'}`}>
                  {stats.segments}
                </span>
              </div>
              {stats.unicode && (
                <p className="text-[9.5px] text-amber-700 leading-snug pt-1">
                  Non-GSM characters (emoji or curly quotes) force UCS-2 encoding — the budget
                  drops from 160 to 70 characters per segment.
                </p>
              )}
              {stats.segments > 1 && !stats.unicode && (
                <p className="text-[9.5px] text-amber-700 leading-snug pt-1">
                  Over one segment. Each extra segment is billed separately.
                </p>
              )}
            </div>
          </>
        ) : (
          <Empty note="Your SMS will render here. 160 characters per billed segment." />
        )}
      </div>
    </div>
  );
}

/* ── Email ────────────────────────────────────────────────────────────────
   The only channel with a subject line, a preheader and a legally required
   unsubscribe footer. Rendered as an inbox reading pane, not a chat bubble. */
function EmailPreview({ body, subject }) {
  return (
    <div className="w-full max-w-[320px] rounded-xl overflow-hidden shadow-xl border border-neutral-200 bg-white">
      <div className="bg-neutral-50 border-b border-neutral-200 px-3.5 py-3">
        <p className={`text-[12.5px] font-semibold leading-snug ${subject ? 'text-neutral-900' : 'text-rose-600'}`}>
          {subject || 'No subject line set'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-7 h-7 rounded-full bg-accent/15 text-accent grid place-items-center text-[10px] font-bold">T</div>
          <div className="leading-tight min-w-0">
            <div className="text-[11px] font-medium text-neutral-800 truncate">ThreadCo</div>
            <div className="text-[9.5px] text-neutral-500 truncate">hello@threadco.in → alex@example.com</div>
          </div>
          <Star size={12} className="ml-auto text-neutral-300 shrink-0" />
        </div>
      </div>

      <div className="px-4 py-4 min-h-[240px] bg-white">
        {body ? (
          <>
            <p className="text-[11.5px] leading-relaxed text-neutral-800 whitespace-pre-wrap break-words">
              {render(body)}
            </p>
            <div className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-[11px] font-semibold text-white">
              Shop the collection
            </div>
          </>
        ) : (
          <Empty note="Your email body will render here." />
        )}
      </div>

      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-[8.5px] leading-relaxed text-neutral-400">
          ThreadCo, 4th Floor, Indiranagar, Bengaluru 560038.
          You are receiving this because you shopped with us.{' '}
          <span className="underline">Unsubscribe</span> · <span className="underline">Preferences</span>
        </p>
      </div>
    </div>
  );
}

/* ── RCS ──────────────────────────────────────────────────────────────────
   Verified sender, rich card with media, and tappable suggested replies.
   Falls back to plain SMS on handsets without RCS, which is worth surfacing. */
function RcsPreview({ body }) {
  return (
    <div className="w-full max-w-[300px] rounded-[26px] overflow-hidden shadow-xl border-[6px] border-neutral-900 bg-white">
      <div className="bg-white border-b border-neutral-200 px-3 py-2.5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-accent/15 text-accent grid place-items-center text-[11px] font-bold">T</div>
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-neutral-900 flex items-center gap-1">
            ThreadCo
            <span className="w-3 h-3 rounded-full bg-[#1a73e8] grid place-items-center">
              <Check size={8} strokeWidth={4} className="text-white" />
            </span>
          </div>
          <div className="text-[9px] text-neutral-500">Verified business · RCS</div>
        </div>
      </div>

      <div className="px-3 py-4 min-h-[300px] bg-[#F5F7FA]">
        {body ? (
          <>
            <div className="rounded-xl overflow-hidden bg-white shadow-sm border border-neutral-200">
              <div className="h-24 bg-gradient-to-br from-accent/25 to-accent/5 grid place-items-center">
                <ImageIcon size={22} className="text-accent/50" />
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11.5px] leading-relaxed text-neutral-800 whitespace-pre-wrap break-words">
                  {render(body)}
                </p>
              </div>
            </div>

            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {['Shop now', 'See sizes', 'Not interested'].map((chip) => (
                <span key={chip} className="rounded-full border border-[#1a73e8]/40 bg-white px-2.5 py-1 text-[10px] font-medium text-[#1a73e8]">
                  {chip}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1 mt-3 text-[9px] text-neutral-400">
              <CheckCheck size={10} /> Delivered · falls back to SMS if RCS is unavailable
            </div>
          </>
        ) : (
          <Empty note="Your RCS card will render here, with media and suggested replies." />
        )}
      </div>
    </div>
  );
}

export default function ChannelPreview({ channel, body, subject }) {
  if (channel === 'sms') return <SmsPreview body={body} />;
  if (channel === 'email') return <EmailPreview body={body} subject={subject} />;
  if (channel === 'rcs') return <RcsPreview body={body} />;
  return <WhatsAppPreview body={body} />;
}
