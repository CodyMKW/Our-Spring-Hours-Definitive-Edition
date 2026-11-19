/* ============================================================================
   BONUS STORY — "THE HUNDREDTH PETAL"          (Part IV, Definitive Edition only)
   Unlocks after you have finished all three parts. One spring after Last Light.
   Uses your Part III state in full (stats are NOT scaled down; deaths, lightPath,
   nightWatch, sparedShigaraki, reunited … all carry over).

   Game: the gang bets they can catch 100 falling petals between them in one day.
     flags.petals   running total (added with fn())
   Each friend who is still with you adds to the pool, and every choice you make
   adds a few more.  100+ = "The Hundredth Petal" (true ending).
   Flags set here: bonusBring, bonusWish
   ========================================================================== */
(function () {
  "use strict";
  const { L, say, n, bg, music, weather, chapter, card, pulse, flash, add, aloof, set, fn, jump, route, iff, menu, opt, enter, exit, clear } = VN;

  const CAST = ["joseph", "cementoss", "falcon", "maki", "uraraka"];
  const alive = (s, k) => !s.dead[k];
  const lostList = (s) => CAST.filter(k => s.dead[k]);
  const NAME = { joseph: "Joseph", cementoss: "Cementoss", falcon: "Falcon", maki: "Maki", uraraka: "Uraraka" };
  const petals = (k) => fn((s) => { s.flags.petals = (s.flags.petals || 0) + k; });

  /* ----------------------------------------------------------------- 1. morning */
  L("p4_start",
    card({ part: 4, eyebrow: "Bonus Story", title: "The Hundredth Petal", sub: "One spring after the last light.", hold: 4600 }),
    fn((s) => { s.flags.petals = 0; }),
    bg("home_morning"), music("spring"), weather("dust"),
    chapter("Bonus", "Morning"),
    n("It's quiet in a way the last few years never were. Not the held-breath quiet of waiting for something to break — the other kind, where the quiet is just the day being unhurried.",
      "Sun on the floorboards. A window that actually opens. Your phone, buzzing itself halfway across the desk."),
    n(s => alive(s, "falcon")
        ? "FALCON: its been 4 minutes and no one has confirmed the petal bet\nFALCON: i am logging this as cowardice"
        : "JOSEPH: Courtyard at noon. I'm bringing too much food. Don't be late."),
    iff(s => alive(s, "falcon"),
      [n("JOSEPH: it's 7am. go back to sleep.\nFALCON: NEVER. the cherry tree has peaked. the TREE has peaked, joseph.")]),
    n(s => alive(s, "uraraka")
        ? "URARAKA: I can see the blossoms from my window. Cody. It's *so pink*. Come see it with me."
        : "A single unread message sits at the bottom of the thread. You don't open it yet. You will. Just not before breakfast."),
    n("The shoebox sits on the shelf where it lives now, no longer a secret. It's fuller than it used to be."),
    iff(s => !!s.flags.foundNote,
      [n("The old note from Uraraka is folded on top. You'd been saving it for the right moment, and, somewhere in the last year, you stopped needing one.")]),
    say("cody", "A year. Okay. A whole year of nothing ending the world."),
    n("You grab your bag. There's time to bring one thing along — something that'll make the day a little more *theirs*."),
    menu(
      opt("A real homemade lunch. For everyone.", { fx: { fri: 1 }, set: { bonusBring: "lunch" } },
        n("You make onigiri badly and with great commitment. Eleven are edible. That's a win."), petals(4)),
      opt("The old Switch Falcon carried for four months.", { fx: { fal: 2 }, set: { bonusBring: "switch" }, req: s => alive(s, "falcon") && s.flags.nightWatch === "fal" },
        n("You found a charger. It took three flea markets. The screen lights up on the first try, and you stand there grinning at a title screen like it's a miracle."), petals(8)),
      opt("A camera, and no plan except to use it.", { fx: { ura: 1, fri: 1 }, set: { bonusBring: "camera" } },
        n("You pick the old camera off the shelf. It still has half a roll of film from before everything. You decide not to develop it yet."), petals(6)),
      opt("Nothing. Just yourself, on time for once.", { set: { bonusBring: "none" } },
        n("You walk out the door with empty hands and an unusually clear head."), petals(2))
    ),
    jump("p4_courtyard")
  );

  /* ----------------------------------------------------------------- 2. courtyard */
  L("p4_courtyard",
    bg("courtyard_bloom"), music("spring"), weather("petals"),
    chapter("Bonus", "Under the Tree"),
    n("The cherry tree is in full bloom. It looks, honestly, a little smug about it."),
    n("Nobody planted it for this. Nobody guarded it for this. It just kept growing while the world fell apart and put itself back together, and now it drops petals over a courtyard that finally has people in it again."),
    say("joseph", s => alive(s, "joseph") ? "You're on time. Who are you and what did you do with Cody?" : "…"),
    iff(s => !alive(s, "joseph"),
      [n("The bench where Joseph always sat is empty. Someone has left a paper crane on it, weighted down with a pebble. You sit next to it anyway.")]),
    iff(s => alive(s, "cementoss"),
      [say("cementoss", "Joseph brought enough food for forty. We have eight. We'll manage.")]),
    iff(s => alive(s, "maki"),
      [say("maki", "Fire Force had a rule about picnics: you secure the perimeter before you open the snacks. I've secured the perimeter. Open the snacks.")]),
    iff(s => alive(s, "falcon"),
      [say("falcon", "Okay, okay, EVERYONE. The bet. One hundred petals, caught by hand, before sundown. No nets. No shaking the tree. Joseph, that means you."),
       say("joseph", "That was one time."),
       say("falcon", "It was *this morning*.")],
      [say("cementoss", "Falcon came up with the petal bet, back when the world was smaller."),
       say("cementoss", "I'd like us to do it for him. If nobody objects."),
       n("Nobody objects. It isn't a question anyone had to ask.")]),
    n(s => alive(s, "uraraka") ? "Uraraka's at your side before you've even set your bag down, a petal already tucked behind her ear like she's got a head start." : "You stand in the petals for a second, and let the year catch up with you."),
    /* round 1 */
    n("The first petals come down on a breath of wind. The courtyard goes quiet, everyone watching the air."),
    menu(
      opt("Stand still. Let one come to you.", { fx: { fri: 1 } },
        n("It lands in your open palm like it was always going to. One. You don't say anything. Joseph, across the courtyard, gives you a nod, which is somehow better than applause."), petals(8)),
      opt("Jump for it. Dignity is a flexible concept.", { fx: { fal: 1 } },
        n("You catch three, miss six, and land in the flowerbed. The petals are fine. Your pride has some mild bruising."), petals(10)),
      opt("Ask the others to help — one big team scramble.", { fx: { fri: 2 } },
        n("It turns into a pile-up within four seconds. Nobody can agree who caught what. Everybody's laughing too hard to care."), petals(12))
    ),
    jump("p4_visitors")
  );

  /* ----------------------------------------------------------------- 3. visitors */
  L("p4_visitors",
    bg("courtyard_bloom", { keep: true }), music("spring"), weather("petals"),
    n("A little later, the gate creaks. Not everyone who shows up today was invited."),
    iff(s => s.flags.lightPath === "renounced",
      [say("light", "I was told there was a bet. I'd like to be clear that I'm not participating."),
       n("He catches a petal on his sleeve without trying. He looks at it for a moment like it's an anomaly in his data."),
       say("light", "…That one doesn't count."), petals(6)],
      iff(s => s.flags.lightPath === "weaponized",
        [say("light", "I won't stay. I wanted to see it, once. A place where the ledger isn't needed."),
         n("He stands at the fence with his hands in his pockets. He doesn't come in. After a while, he leaves a single clean sheet of paper folded on the bench: a list of everyone he decided, this year, not to write down."), petals(3)],
        [say("light", "Hope I'm not interrupting. I was in the neighborhood. By which I mean I made a point of being in the neighborhood."),
         n("He stays long enough to say something polite to everyone and nothing at all about himself. It's a start."), petals(4)])),
    iff(s => !!s.flags.sparedShigaraki,
      [n("A shape lingers by the broken fence — grey hair, a posture like he's expecting to be told to leave."),
       say("shigaraki", "I didn't bring anything. I didn't know what you bring."),
       menu(
         opt("\"Sit down. There's too much food anyway.\"", { fx: { fri: 2 } },
           say("shigaraki", "…Fine. For a few minutes."),
           n("He sits at the far end of the bench like someone trying a new language. A petal lands on his knee. He stares at it as if it's personally offended him. Then, very slightly, he smiles."), petals(8)),
         opt("Nod to him and let him choose.", { fx: { fri: 1 } },
           n("You nod. He nods back. He stays at the fence line the whole afternoon, and it's the most he's ever been near people without wanting to leave."), petals(4)))]),
    iff(s => alive(s, "maki") && alive(s, "light"),
      [say("maki", "Don't look at me like that. He's invited. I invited him. He knows the rules: no ledgers on the grass."),
       say("light", "I've left it at home. It's not even *there* anymore.")]),
    n("By mid-afternoon, the count is climbing. Someone's keeping a tally on the back of a napkin in four different handwritings."),
    jump("p4_lanterns")
  );

  /* ----------------------------------------------------------------- 4. lanterns */
  L("p4_lanterns",
    bg("courtyard_lanterns"), music("hope"), weather("fireflies"),
    chapter("Bonus", "Lanterns"),
    n("The sun goes down the way it did the night of the festival, two years and a lifetime ago. Somebody — Joseph, probably — has brought paper lanterns. Nobody asks where they came from."),
    iff(s => lostList(s).length === 0,
      [n("There's one for each of you. Eight lights, eight names, each person's hand a little unsteady. It's the first time in a long time none of you have to light one for someone who isn't there."),
       say("cementoss", "We should do this every year. Not for any reason. Just because we can.")],
      [n(s => "There are more lanterns than people. You didn't need to count them. You know exactly who the extra ones are for: " + lostList(s).map(k => NAME[k]).join(", ") + "."),
       n("Nobody says much. Nobody has to. You light the first one together, and the paper holds the flame like it knows what it's carrying."),
       iff(s => !alive(s, "falcon"),
         [n("The last lantern has a drawing on it in marker: a bad little sketch of a pair of taped glasses, and a line underneath in uneven handwriting — *rematch pending.*"), petals(2)]),
       iff(s => !alive(s, "joseph"),
         [n("Somebody tied a bundle of tomato blossoms to Joseph's lantern. Cementoss, you think, though he'd deny it."), petals(2)]),
       iff(s => !alive(s, "uraraka"),
         [n("You write her name on the paper with a steadier hand than you thought you had. *I finished the sentence,* you add, small, in the corner."), petals(2)]),
       iff(s => !alive(s, "maki"),
         [n("A patch of Company 8's flame-and-star crest is sewn onto the lantern's base. Someone found one. Someone always does."), petals(2)]),
       iff(s => !alive(s, "cementoss"),
         [n("A small stone is set beside the lantern, flat and perfectly smooth, like he made it himself."), petals(2)])]),
    n("A lantern each. A wish each. The whole courtyard glows."),
    menu(
      opt("Wish for everyone here. Out loud, so it counts.", { fx: { fri: 2 }, set: { bonusWish: "everyone" } },
        say("cody", "I wish that whatever comes next, we get to be there for it. Together. All of us."),
        n(s => lostList(s).length ? "Nobody says amen. It's quiet for a long moment, and then someone laughs, wetly, and the rest of you follow." : "Falcon holds his lantern up and yells 'AGREED' at the sky, and somewhere an owl takes offense."), petals(10)),
      opt("Wish for something small and selfish.", { fx: { ura: 1 }, set: { bonusWish: "small" } },
        n("You wish for a Saturday with nothing in it. It feels indulgent. It feels like exactly the kind of wish this world owes you."), petals(6)),
      opt("Keep your wish to yourself.", { aloof: 1, set: { bonusWish: "silent" } },
        n("The lantern rises. Some wishes are the kind that only work if you don't say them, and some are just easier to keep."), petals(3))
    ),
    n("One by one, the lanterns lift off — a slow constellation rising out of the courtyard, up past the cherry tree, over the school roof, into a sky with room in it for all of them."),
    route(s => {
      const f = s.flags;
      if (f.optedOut || s.aloof >= 6) return "p4_close_lone";
      if (alive(s, "uraraka") && (f.confessed || s.stats.ura >= s.stats.fal)) return "p4_close_ura";
      if (alive(s, "falcon")) return "p4_close_fal";
      return "p4_close_group";
    })
  );

  /* ----------------------------------------------------------------- 5. closing scenes (one per route) */
  L("p4_close_ura",
    bg("rooftop_dawn"), music("quiet"), weather("petals"),
    chapter("Bonus", "Dawn on the Roof"),
    n("Everyone drifts home, eventually. Somehow you and Uraraka end up on the roof as the sky turns the pale pink of a held breath.",
      "Same roof. Different world. Same two people, a little more worn in, a little more sure."),
    say("uraraka", "I kept count. Don't tell Falcon. I think we're close."),
    say("cody", "How close?"),
    say("uraraka", "Close enough that it's going to come down to one petal. And I'd like it to be a good one."),
    n("The wind turns. A single petal drifts across the rooftop in no hurry at all, wobbling the way only the very last one ever does."),
    menu(
      opt("Reach for it together.", { fx: { ura: 3 } },
        n("Your hands meet around it at exactly the same moment. Neither of you let go. Neither of you is counting petals anymore."), petals(10)),
      opt("Let her catch it. She's earned it.", { fx: { ura: 2 } },
        say("uraraka", "Cody. You *always* do this. You do it so quietly I almost miss it."),
        n("She catches it. She holds it out to you anyway."), petals(8)),
      opt("Let it fall. Some things are better as a maybe.", { fx: { ura: 1 } },
        n("It lands on the roof between you. You both look at it. Then at each other. Neither of you picks it up."), petals(4))
    ),
    jump("p4_finale")
  );

  L("p4_close_fal",
    bg("rooftop_dawn"), music("quiet"), weather("petals"),
    chapter("Bonus", "Dawn on the Roof"),
    n("Everyone drifts home. Falcon doesn't. He's on the rooftop railing with his shoes off, watching the sky go pink like it owes him money."),
    say("falcon", "Don't tell the others I'm sentimental. I have a reputation."),
    say("cody", "You carried a dead Switch for four months."),
    say("falcon", "…Okay, *one* sentimental thing. Allowed. Rule of exceptions."),
    iff(s => s.flags.bonusBring === "switch",
      [n("You pull out the old Switch. It still boots. Falcon doesn't say anything for a long moment, then very carefully takes it with both hands."),
       say("falcon", "You fixed it. You *fixed* it. I am — this is — I'm going to need a minute."), petals(8)],
      [say("falcon", "Hey. Thanks for staying. All of it. The whole way. I'd have been a lot worse at all this without you."), petals(5)]),
    n("The wind turns. A petal drifts between you, slowly, mockingly, like a dare."),
    menu(
      opt("Race him for it.", { fx: { fal: 2 } },
        n("You both lunge. You collide. You both miss. You both lie on the rooftop wheezing with laughter while it floats, unbothered, off the edge."), petals(8)),
      opt("Hold still. Let him have it.", { fx: { fal: 2 } },
        say("falcon", "Wait, are you *letting* me— I don't want a pity petal!"),
        n("He catches it. He tells everyone for years that it was a fair fight."), petals(8)),
      opt("Tell him you're proud of him.", { fx: { fal: 3 } },
        say("falcon", "…Shut up. You can't just say that."),
        n("He looks away for a while. When he looks back, his eyes are bright, and he doesn't make a joke."), petals(10))
    ),
    jump("p4_finale")
  );

  L("p4_close_group",
    bg("rooftop_dawn"), music("quiet"), weather("petals"),
    chapter("Bonus", "Dawn on the Roof"),
    n(s => lostList(s).length ? "The ones who are left walk up to the roof together without anyone proposing it. There's room on the railing for all of you. And, you think, room for the ones who aren't here."
                              : "Everyone ends up on the roof in the end. Somebody has brought a thermos. Somebody always does."),
    say("cementoss", s => alive(s, "cementoss") ? "I kept count. We're close. I'd rather not say how close." : "…"),
    iff(s => !alive(s, "cementoss"),
      [say("joseph", s => alive(s, "joseph") ? "We're close. Don't jinx it. Let's just enjoy the sunrise." : "…")]),
    n("The wind carries a single petal across the rooftop. All of you watch it. Nobody moves."),
    menu(
      opt("Everyone reaches at once.", { fx: { fri: 2 } },
        n("It's absurd. It's a scramble. It's the most ridiculous way anyone's ever caught a petal, and somehow, it counts."), petals(10)),
      opt("Let it go. It's enough that you all watched it.", { fx: { fri: 1 } },
        n("It drifts out over the roof edge and into the pale pink sky. Nobody mourns it. That's the nicest part."), petals(5))
    ),
    jump("p4_finale")
  );

  L("p4_close_lone",
    bg("rooftop_dawn"), music("quiet"), weather("petals"),
    chapter("Bonus", "Dawn on the Roof"),
    n("You stayed at the edge of the lanterns all night, the way you always do. Somehow that was okay. Nobody made you come closer.",
      "When the others leave, someone stays behind — the way someone always does. It doesn't matter who. It matters that it was offered."),
    say("cody", "Is it weird that I'm still not used to this? People who just… want me around."),
    n(s => alive(s, "joseph") ? "Joseph doesn't make a speech about it. He just hands you the thermos and sits down on the rooftop next to you, a respectful two feet away, which is exactly the right distance." : "Somebody sits down on the rooftop next to you, a respectful two feet away, which is exactly the right distance."),
    say("cody", "…I think I'm getting there."),
    n("A single petal drifts over the railing, wobbling in the dawn."),
    menu(
      opt("Reach for it.", { fx: { fri: 2 } },
        n("It's the first time all day you've reached for anything. It lands in your hand. You look at it for a long time."), petals(10)),
      opt("Watch it go.", {},
        n("It drifts off the roof and out of sight. You let it. You're allowed to take your time."), petals(5))
    ),
    jump("p4_finale")
  );

  /* ----------------------------------------------------------------- 6. finale */
  L("p4_finale",
    chapter("Bonus", "The Count"),
    n("Back at the courtyard, in the first slant of morning, the napkin tally gets put on a bench and a small ceremony forms around it, the way ceremonies do when nobody planned one."),
    n(s => "The final count, in four different handwritings, with at least two disputed entries: **" + (s.flags.petals + 30 + 8 * CAST.filter(k => alive(s, k)).length) + " petals.**"),
    route(s => {
      const total = s.flags.petals + 30 + 8 * CAST.filter(k => alive(s, k)).length;
      s.flags.petalTotal = total;
      return total >= 100 ? "ending_hundredth" : total >= 70 ? "ending_almost" : "ending_quiet_spring";
    })
  );

  /* ----------------------------------------------------------------- endings */
  const lostLine = (s) => {
    const l = lostList(s).map(k => NAME[k]);
    return l.length ? "The count had a few extra entries on it that nobody would admit to making. They were for " + l.join(", ") + ". Nobody disputed them." : "Everyone who started the year is still here. Nobody will ever stop counting that.";
  };

  VN.ending("ending_hundredth", {
    part: 4, kind: "true", bg: "courtyard_bloom", music: "hope", weather: "petals",
    title: "The Hundredth Petal", hint: "Catch one hundred petals, together — with a little help from everyone you kept.",
    summary: "One hundred petals. One cherry tree. Everyone who stayed.",
    lines: [
      s => "The final count is " + s.flags.petalTotal + ". Falcon insists on rounding it to a hundred for the record, and nobody has the heart to argue. It was never really about the number.",
      lostLine,
      "A year ago you weren't sure there'd be another spring. Now there's a bench full of petals, a tree that's never been this pink, and a morning with no reason to hurry. This is what you were fighting for.",
      "Happy hanami. See you next spring.",
    ],
  });
  VN.ending("ending_almost", {
    part: 4, kind: "good", bg: "rooftop_dawn", music: "hope", weather: "petals",
    title: "Almost a Hundred", hint: "Catch nearly a hundred petals.",
    summary: "A few petals short, and honestly, who's counting?",
    lines: [
      s => "The final count is " + s.flags.petalTotal + ". Short of a hundred. Joseph announces a recount, Falcon announces a rematch, and the entire group agrees without another word to do it again next spring.",
      lostLine,
      "That's what good endings are: not the ones that finish, but the ones that leave a reason to meet again.",
    ],
  });
  VN.ending("ending_quiet_spring", {
    part: 4, kind: "neutral", bg: "courtyard_lanterns", music: "quiet", weather: "fireflies",
    title: "A Quiet Spring", hint: "Spend the day quietly.",
    summary: "Not a record. A good day all the same.",
    lines: [
      s => "The final count is " + s.flags.petalTotal + ". Not close, but nobody ever cared about the number as much as they pretended to.",
      lostLine,
      "It was a quiet day under a tree that survived everything. Sometimes that's all a spring has to be.",
    ],
  });
})();
