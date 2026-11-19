/* ============================================================================
   PART III — LAST LIGHT
   Stakes are real: five people can die (S.dead). Every peril is deterministic
   and *fair* — the outcome depends on your choice plus your bond stats, never
   on a hidden roll.  Flags used:
     lightPath   "active" (default) | "renounced" | "weaponized" | "sidelined"
     optedOut    you walked away before the battlegrounds
   ========================================================================== */
(function () {
  "use strict";
  const { L, say, n, bg, music, weather, chapter, card, shake, flash, pulse, add, aloof, set, kill, jump, route, iff, menu, opt } = VN;

  const dead = (s, k) => !!s.dead[k];
  const deathCount = (s) => Object.keys(s.dead).filter(k => s.dead[k]).length;

  /* ---------------------------------------------------------------- Chapter 1 */
  L("p3_start",
    card({ part: 3, title: "Last Light", sub: "Everything you chose has been leading here." }),
    bg("courtyard_ruined"), music("quiet"), weather("petals"),
    chapter("Chapter 1", "Still Standing"),
    n("The cherry tree is still standing. After everything, that's the first thing you notice — and the thing you keep looking at, to avoid looking at anything else.",
      "It's been a month since the courtyard. A month of patrols, rebuilt barricades, and learning what peace tastes like when it's only borrowed."),
    n(s => s.flags.reunited
        ? "Uraraka sits beside you under the branches, her shoulder against yours, as if the last two years had been a long breath finally let go."
        : "Uraraka keeps a careful, friendly distance under the branches. You both know the distance isn't really about space."),
    say("joseph", "So. Quiet month. Nobody tried to end the world. Is that a good sign or are we being set up?"),
    say("cementoss", "Both. It is usually both."),
    say("falcon", "I vote we enjoy it *loudly* until proven wrong."),
    n("Maki arrives last, jaw tight, a folded sheet of paper in her hand. Behind her, in the doorway, Light — not smiling."),
    jump("p3_ch2")
  );

  /* ---------------------------------------------------------------- Chapter 2: the notebook */
  L("p3_ch2",
    bg("hideout"), music("tense"), weather("dust"),
    chapter("Chapter 2", "The Notebook"),
    say("light", "I've been withholding something. I'd like to say that was strategic, and it was. It was also cowardice."),
    n("He sets a black notebook on the table. Plain cover. Worn corners. Ordinary in the way dangerous things often are."),
    say("light", "It works the way you'd fear. Write a name, and the person stops being a problem. Every entry in my ledger that said *resolved* — that was this."),
    n(s => s.flags.lightStance === "allied"
        ? "Your stomach drops. *Do what you have to. Quietly.* You said that. You said that to him."
        : s.flags.lightStance === "defied"
          ? "You told him to take the long way. Part of you is relieved. Part of you wonders how many other doors he closed without asking."
          : "*I don't want to know how.* You didn't. Now you do."),
    say("falcon", "Hang on. Fourteen raiders. Two kids. Did you—"),
    say("light", "The children are in the east wing. Alive. Fed. I didn't use it there. I'd like that on the record."),
    n("It's less comfort than he thinks. It's also, you realize, a genuine confession. He's trying to be seen."),
    say("light", "All For One knows I have it. He wants it. And I have to decide tonight what it is — a weapon, a temptation, or something I burn."),
    say("light", "I'd like your opinion before I do. I notice I've stopped trusting my own."),
    menu(
      opt("\"Burn it. Nobody should have this.\"", { fx: { fri: 1 }, set: { lightPath: "pending_renounce" } },
        say("light", "...Nobody. Including me."),
        n("For a long moment he doesn't answer. Then he nods, once, slowly, like a man setting down something he's carried so long it became part of his arm.")),
      opt("\"Keep it. Use it on him. Only him.\"", { fx: { light: 3 }, set: { lightPath: "weaponized" } },
        say("light", "One name. One use. That's the discipline."),
        n("He says it like a vow. You're not certain which of you he's trying to convince.")),
      opt("\"It's your burden. I won't carry it for you.\"", { aloof: 1, set: { lightPath: "sidelined" } },
        say("light", "Fair. And lonely."),
        n("He pockets it, and the room feels a few degrees colder."))
    ),
    n("Nobody sleeps. The rooftop garden's the only place that feels safe enough to be afraid in."),
    jump("p3_ch3")
  );

  /* ---------------------------------------------------------------- Chapter 3: rooftop follow-up */
  L("p3_ch3",
    bg("rooftop_night"), music("night"), weather("fireflies"),
    chapter("Chapter 3", "One Quiet Night"),
    n("Night on the rooftop. The tomato vines glow faintly in the city's last working streetlight. Everyone ends up here eventually, without anyone calling it a meeting."),
    say("light", "I won't use it on a person who hasn't earned it. That's the line. I wanted you to hear me say it."),
    menu(
      opt("\"I believe you. Prove it tomorrow.\"", { fx: { light: 2 }, req: s => s.flags.lightPath !== "renounced" },
        say("light", "Tomorrow, then."),
        iff(s => s.flags.lightPath === "pending_renounce", [set("lightPath", "renounced")])),
      opt("\"Then give it to me. I'll hold it.\"", { fx: { light: 1, fri: 1 } },
        say("light", "...No. If I hand it off, I stop being accountable for it. But thank you for offering."),
        iff(s => s.flags.lightPath === "pending_renounce", [set("lightPath", "renounced")])),
      opt("Stay quiet and let the night be quiet.", {},
        n("Nobody speaks. Falcon, impossibly, doesn't joke. It's the loudest silence you've ever sat in."),
        iff(s => s.flags.lightPath === "pending_renounce", [set("lightPath", "renounced")]))
    ),
    iff(s => s.flags.lightPath === "pending_renounce", [set("lightPath", "renounced")]),
    n("Somewhere past the skyline, an alarm that used to mean evacuation. It means something else now. It means *he's here.*"),
    jump("p3_ch4")
  );

  /* ---------------------------------------------------------------- Chapter 4: Maki peril */
  L("p3_ch4",
    bg("gas_station"), music("battle"), weather("rain"),
    chapter("Chapter 4", "Fuel Stop, Again"),
    n("The generator at the gas station is the only thing keeping the barricade lights on. All For One's people want it dark.",
      "Maki gets there first. You get there second. That's the whole difference between a rescue and a funeral, and it comes down to what you do in the next ten seconds."),
    say("maki", "Three of them, one Flare-user. I can hold the line if someone covers the pumps."),
    menu(
      opt("Cover the pumps and fight beside her.", { fx: { maki: 2 } },
        iff(s => s.stats.maki >= 5,
          [n("You move as one. Her flame, your timing; a language neither of you has a word for, spoken fluently. They break and run."),
           say("maki", "Not bad. I might keep you.")],
          [n("It works. Barely. Maki takes a burn across her arm that would've been worse if you'd been a half-second slower."),
           say("maki", "Don't make that face. I've had worse. I've had worse *today*.")])),
      opt("Order her to fall back — you'll hold the pumps.", { fx: { maki: -1 } },
        say("maki", "I don't take orders from civilians."),
        n("She doesn't fall back. The flare-user's blast catches her on the turn."),
        iff(s => s.stats.maki >= 7,
          [n("You tackle her out of the line with a half-second to spare. She's furious. She's alive.")],
          [kill("maki"), n("You were three steps too far. She goes down in a column of her own fire, and doesn't get up. The generator is saved. You will never be sure what it cost.")])),
      opt("Hang back — let her handle it.", { aloof: 1, fx: { maki: -2 } },
        n("You stay behind the pump. She's good. She's also alone."),
        iff(s => s.stats.maki >= 8,
          [n("She wins anyway — barely, furiously — and doesn't speak to you for an hour.")],
          [kill("maki"), n("It's over in a breath. She had a plan for three. There were four.")]))
    ),
    iff(s => dead(s, "maki"),
      [n("You carry what's left of her unit's patch back to the Hideout. Somebody ought to have it.")]),
    jump("p3_ch5")
  );

  /* ---------------------------------------------------------------- Chapter 5: Falcon peril */
  L("p3_ch5",
    bg("forest_dusk"), music("battle"), weather("fireflies"),
    chapter("Chapter 5", "The Green Mile, Again"),
    n("The forest's been rigged — wire, flares, a kill-zone laid out like a joke only the person who set it finds funny.",
      "Falcon is in the middle of it. He froze. You've never seen him freeze."),
    say("falcon", "Cody. Don't. Don't come in. I can see the trip — I can *see* it, I just can't—"),
    menu(
      opt("\"Look at me. Breathe. Step where I step.\"", { fx: { fal: 2 } },
        iff(s => s.stats.fal >= 4,
          [say("falcon", "...Okay. Okay. Where you step."),
           n("He walks out of it one shaking step at a time. At the edge, he grips your sleeve and doesn't let go for a long time.")],
          [n("He tries. His foot lands a half-inch wrong."), shake(), kill("falcon"),
           n("The flare takes him before you can reach him. In the silence afterward, you realize you never got to say the thing you were going to say next.")])),
      opt("Charge in and pull him out.", { fx: { fal: 1 } },
        iff(s => s.stats.fri >= 6 || s.stats.fal >= 7,
          [n("It's reckless. It also works, because he trusts you enough to stop thinking and just move."),
           say("falcon", "I hate that it worked.")],
          [shake(), kill("falcon"), n("The wire sings. It doesn't care how much you love him.")])),
      opt("Freeze with him. Wait for help.", { aloof: 1 },
        iff(s => s.stats.fal >= 7,
          [n("He steadies himself — you can't tell how — and walks out on his own. He doesn't say why. You think you know.")],
          [kill("falcon"), n("Help is four minutes away. The wire is four seconds.")]))
    ),
    n(s => dead(s, "falcon") ? "You bury a taped pair of glasses at the foot of the cherry tree. Nobody says anything. Nobody has to." : "He's alive. Rattled. Cracking jokes by the time you reach the road, in a voice a little thinner than usual. You let him."),
    jump("p3_ch6")
  );

  /* ---------------------------------------------------------------- Chapter 6: Joseph peril */
  L("p3_ch6",
    bg("hallway_ruined"), music("battle"), weather("dust"),
    chapter("Chapter 6", "Where It Began"),
    n("The school. Of course it was the school. Where the festival lights hung two years ago, scorch marks.",
      "Shigaraki's waiting in the corridor with one hand raised and Joseph pinned against the wall, a hairbreadth from decay."),
    say("shigaraki", "Show me what you're worth, Cody. Or let him pay for the lecture."),
    menu(
      opt("\"Let him go. Fight me.\"", { fx: { fri: 1 } },
        say("shigaraki", "...Heh."),
        n("He drops Joseph and turns, and for a moment it's just the two of you — one boy who learned to survive by breaking things and one who learned it by holding them together.")),
      opt("Hesitate. Calculate.", {},
        iff(s => s.stats.fri >= 9,
          [n("Joseph does it himself — jabs an elbow, drops, rolls. It's the most reckless thing he's ever done and the best-timed. 'Learned from somebody,' he mutters, looking at you.")],
          [kill("joseph"), n("A beat too slow. Joseph's eyes find yours, and he's smiling, like he's apologizing for something. Then he isn't there.")])),
      opt("Throw yourself between them.", { fx: { fri: 2 } },
        n("It shouldn't work. Shigaraki's hand stops an inch from your chest. For the first time, he looks unsure what he's doing here."))
    ),
    iff(s => !dead(s, "joseph") && s.flags.sparedShigaraki,
      [say("shigaraki", "You were right. In the courtyard. About him. About me."),
       say("shigaraki", "I'll buy you ten minutes. Not eleven."),
       add("fri", 1)]),
    jump("p3_ch7")
  );

  /* ---------------------------------------------------------------- Chapter 7: home */
  L("p3_ch7",
    bg("home_night"), music("sorrow"), weather(null),
    chapter("Chapter 7", "The Last Quiet Hour"),
    n("Your old house. Boards across the window, dust in the lamp light. Somebody lit a candle. Somebody always does."),
    n(s => dead(s, "uraraka") ? "" : s.flags.reunited
      ? "Uraraka finds you in your old room. She doesn't say anything. She just sits with you, in the dark, on the floor where you used to do homework."
      : "Uraraka stands at the door of your old room. She doesn't come in. She's still waiting for you to ask."),
    menu(
      opt("Tell her what you couldn't say before.", { fx: { ura: 3 }, set: { confessed: true } },
        say("cody", "I should've said it two years ago. I'm saying it now, in case there isn't a later."),
        say("uraraka", "There's a later. I'm not letting there not be."),
        n("It's not a promise anyone can keep. She makes it anyway, and it holds, the way some promises do.")),
      opt("Share the old shoebox. The photos. The note.", { fx: { ura: 2, fri: 1 }, req: s => !!s.flags.foundNote },
        say("uraraka", "You kept it. You found it."),
        n("She laughs, wet-eyed. 'I was going to finish that sentence in person.' 'Finish it.' 'After.'")),
      opt("Keep it light. Don't make it heavier than it is.", { fx: { ura: 1 } },
        n("You talk about nothing for an hour — the cat, the tomatoes, Falcon's disastrous haircut. It's exactly what you both needed."))
    ),
    say("joseph", s => dead(s, "joseph") ? "Cody. Come on. They're coming. Move." : "Cody. Time. They're coming."),
    jump("p3_ch8")
  );

  /* ---------------------------------------------------------------- Chapter 8: battlegrounds */
  L("p3_ch8",
    bg("battlegrounds_dusk"), music("battle"), weather("embers"),
    chapter("Chapter 8", "The Battlegrounds"),
    n("A wide, scorched plain at the edge of the city. All For One stands at the far side of it, alone, in no hurry. Behind you, whoever's left.",
      s => deathCount(s) ? "There are fewer of you than there were a month ago. You count anyway." : "All of you made it this far. You count, and count again, and it's still everyone."),
    menu(
      opt("Step forward. End this.", { fx: { fri: 1 } }),
      opt("Walk away. You've done enough.", { aloof: 3, set: { optedOut: true } },
        n("It would be so easy. The others look at you. Nobody calls you a coward. That's almost worse."),
        route(() => "p3_final"))
    ),
    n("Shigaraki is first, a blur of grey and furious intent. Cementoss meets him with a wall that wasn't there a second before."),
    menu(
      opt("\"Cementoss — together!\"", {},
        n("You don't hold the line alone. Neither does he. The wall holds."),
        add("fri", 1)),
      opt("\"Hold him! I'll go around!\"", {},
        iff(s => s.stats.fri >= 7,
          [n("It's close. The wall shudders and does not fall. Cementoss's hands are bleeding stone dust by the end of it.")],
          [kill("cementoss"), n("He holds the wall for eleven seconds. It's enough. It always was going to be exactly enough.")])),
      opt("Freeze. Everything is happening too fast.", { aloof: 1 },
        iff(s => s.stats.fri >= 10,
          [n("Cementoss doesn't wait for you. He shouldn't have to. He's already moving.")],
          [kill("cementoss"), n("The wall comes down. You're still standing. You don't know how.")]))
    ),
    n("From the left flank, a shout. Uraraka — mid-leap, pinned by wreckage, a Flare-user's blast closing."),
    menu(
      opt("Run to her. Don't think.", { fx: { ura: 2 } },
        iff(s => s.stats.ura >= 7,
          [n("Your hand closes on hers. 'Idiot,' she says, laughing and crying at once. 'You *idiot.*'")],
          [kill("uraraka"), n("You are one pace too far. She's still smiling when the light takes her.")])),
      opt("Signal Falcon and Maki to cover her.", { fx: { fri: 1 } },
        iff(s => !dead(s, "falcon") && !dead(s, "maki"),
          [n("They are already moving. She comes out of it with a bruise the size of a dinner plate and a story.")],
          [iff(s => s.stats.ura >= 9,
            [n("It almost isn't enough. It is.")],
            [kill("uraraka"), n("Nobody is left to cover her. You hear her say your name, once.")])])),
      opt("Stay on All For One. Trust her.", { aloof: 1 },
        iff(s => s.stats.ura >= 9,
          [n("She frees herself. She always does. 'You'd better have been winning,' she snaps. You were.")],
          [kill("uraraka"), n("Trust is a decision. Sometimes it's the wrong one.")]))
    ),
    shake(), flash("#fff"),
    say("allforone", "You see? Every one of them is a debt you will never repay. That is what power costs. I'm offering you a way to stop paying."),
    jump("p3_climax")
  );

  /* ---------------------------------------------------------------- climax (lightPath-aware) */
  L("p3_climax",
    chapter("Climax", "Last Light"),
    n(s => s.flags.lightPath === "weaponized"
        ? "In your pocket, the notebook's edge presses against your ribs. Light's voice, from earlier tonight: *one name, one use.*"
        : "Light stands at your shoulder, empty-handed. You can feel what he's decided in how still he is."),
    menu(
      opt("Strike together — all of you, everything you have.", { fx: { fri: 2 } },
        n("The plain lights up. Every Flare, every wall, every last stubborn thing that got you here. For a moment it's hard to tell whose is whose.")),
      opt("Use the notebook.", { fx: { light: 3 }, req: s => s.flags.lightPath === "weaponized" },
        n("Light writes three words. His hand doesn't shake. Something in the air snaps, like a string pulled past its limit."),
        set("usedNotebook", true)),
      opt("Offer All For One what he actually wants: someone to stop him.", { fx: { fri: 1, ura: 1 }, req: s => s.stats.fri >= 8 },
        say("cody", "You've been alone a long time. I can tell. I've been there. It doesn't have to end like this."),
        n("It shouldn't work. It almost does. And that 'almost' is enough room to move in."))
    ),
    flash("#fff"),
    jump("p3_final")
  );

  L("p3_final", route(s => resolveFinalEnding(s)));

  function resolveFinalEnding(s) {
    const { ura, fri, fal } = s.stats;
    const D = deathCount(s);
    const f = s.flags;
    if (f.optedOut) return "end_quietlife";
    if (s.aloof >= 6) return "end_isolation";
    if (f.lightPath === "weaponized" && s.stats.light >= 7) return "end_shadowalliance";
    if (f.lightPath === "renounced" && D === 0) return "end_redemption";
    if (D === 0 && fri >= 6 && (ura >= 5 || fal >= 5)) return "end_dawnunity";
    if (D >= 3) return "end_pyrrhic";
    return "end_costlyvictory";
  }
  VN.resolveFinalEnding = resolveFinalEnding;

  /* ---------------------------------------------------------------- endings */
  const lost = (s) => {
    const names = { joseph: "Joseph", cementoss: "Cementoss", falcon: "Falcon", maki: "Maki", uraraka: "Uraraka" };
    const l = Object.keys(names).filter(k => s.dead[k]).map(k => names[k]);
    return l.length ? "You carry " + l.join(", ") + (l.length === 1 ? " with you now." : " with you now, all of them.") : "Nobody is missing from the line.";
  };

  VN.ending("end_dawnunity", {
    part: 3, kind: "true", bg: "battlegrounds_dawn", music: "hope", weather: "petals",
    title: "Dawn Unity", hint: "Everyone lives, and your bonds hold.",
    summary: "The whole family, at sunrise.",
    lines: [
      "The sun comes up over the battlegrounds and everyone is there to see it.",
      "Not because the fight was easy. Because every choice, big and small, added up to people who would not leave each other behind.",
      "The cherry tree will bloom again in spring. This time, you'll all be there to watch.",
    ],
  });
  VN.ending("end_redemption", {
    part: 3, kind: "true", bg: "ruined_dawn", music: "hope", weather: "ash",
    title: "Redemption", hint: "Convince Light to burn the notebook, and lose no one.",
    summary: "Even Light finds a way back.",
    lines: [
      "Light burns the notebook at dawn. Not as a gesture. As an act of faith.",
      "Everyone you love is standing there to watch it go, and nobody says it, but every one of you understands: the world can be saved without being ruled.",
      "He leaves the ledger behind. He stays.",
    ],
  });
  VN.ending("end_shadowalliance", {
    part: 3, kind: "neutral", bg: "hideout_alert", music: "tense", weather: "dust",
    title: "Shadow Alliance", hint: "Take Light's path and use the notebook.",
    summary: "It worked. You know the price.",
    lines: [
      "The notebook ends it. Cleanly. Silently. The way it always does.",
      "You and Light are the only ones who know exactly how. Neither of you says it aloud, and neither of you ever will.",
      s => lost(s),
    ],
  });
  VN.ending("end_costlyvictory", {
    part: 3, kind: "good", bg: "battlegrounds_dawn", music: "sorrow", weather: "embers",
    title: "Costly Victory", hint: "Win — but not without loss.",
    summary: "Victory, with a hollow place in it.",
    lines: [
      "It's over. By every definition that counts, you won.",
      s => lost(s),
      "There'll be a spring. There'll be a tree in bloom. Some of you will sit under it and some of you will be in it, in petals, in memory. That's what winning looked like.",
    ],
  });
  VN.ending("end_pyrrhic", {
    part: 3, kind: "bad", bg: "battlegrounds", music: "sorrow", weather: "ash",
    title: "Pyrrhic", hint: "Win, but lose most of the people you came with.",
    summary: "Victory so costly it hardly feels like one.",
    lines: [
      "All For One is gone. The plain is quiet.",
      s => lost(s),
      "You stand in the smoke and try to remember what you were fighting for. It takes a long time to answer. When you do, the answer is a list of names.",
    ],
  });
  VN.ending("end_isolation", {
    part: 3, kind: "bad", bg: "ruined_city", music: "sorrow", weather: "ash",
    title: "Isolation", hint: "Keep everyone at arm's length until the end.",
    summary: "The war ends. You're still alone.",
    lines: [
      "The fight ends. You aren't sure how you survived it, or why it should matter.",
      "Everyone else stands together, a little distance away. There's a space beside them that was meant for you. It's not a long way across. It has never felt longer.",
    ],
  });
  VN.ending("end_quietlife", {
    part: 3, kind: "neutral", bg: "forest", music: "quiet", weather: "fireflies",
    title: "Quiet Life", hint: "Walk away before the final battle.",
    summary: "Somebody else's war. Your own small peace.",
    lines: [
      "You walk away, and the forest swallows the sound of the fighting behind you.",
      "Somewhere, somebody wins or doesn't. You keep a garden. You learn the names of birds. It isn't glorious. It is, in its way, enough.",
    ],
  });
})();
