---
title: 206 Columbine Drive calendar events have never had a "Pay is $X" line
tags: [decisions, calendar, payroll]
date: 2026-09-25
status: open — root cause not found
---

# 206 Columbine Drive calendar events have never had a "Pay is $X" line

**What happened:** Building [[payroll]]'s owed-tracking, every Columbine
job for Amy came back missing from her computed total. Checked every
Columbine event on the Cleans calendar going back weeks — none of them
have ever had a `Pay is $X` line in the description, unlike every other
property (Sahara, Palo Verde, Fremont, Bluegill, Unit 324 all do). Fixed
by adding the line to the three affected events by hand once Bryce
provided his own paper ledger to confirm the right amount ($170/job).

**Why this matters beyond payroll:** anything that reads a job's pay from
its calendar description will silently drop Columbine — this isn't
specific to the payroll feature.

**Not yet found:** what actually creates these Columbine events. If it's
the same automation that creates Sahara/Palo Verde/Fremont events with
working pay lines, something in its Columbine-specific path is dropping
that field. If Bryce enters Columbine manually, he's just never included
it. Whoever picks this up next should check both before assuming either
way.

**Next time:** don't assume a property's events are complete just
because most are — check each property's actual description text before
building anything that depends on it, the same lesson as the field-
mapping-staleness note in [[zapier-automations]].
