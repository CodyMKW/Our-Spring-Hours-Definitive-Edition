/* ============================================================================
   PART II — ASHFALL
   Two years later. Stats carry over from Part I (halved). New stats:
     maki   bond with Maki Oze        light  trust in Light Yagami
   Flags set here (and read by Part III):
     cat            you let the school's stray cat adopt you
     foundNote      you opened the shoebox at home
     nightWatch     "fal" | "maki" | "alone"  what you did on the forest night watch
     lightStance    "allied" | "defied" | "looked-away"  your answer to the water-depot dilemma
     gardenTalk     "ura" | "all" | "maki" | "cementoss"  how you spent the garden evening
     sparedShigaraki you talked Shigaraki down in the courtyard
     reunited       you closed the distance with Uraraka
     p2path         "unity" | "light" | "quiet"  your answer to All For One
   ========================================================================== */
(function () {
  "use strict";
  const { L, say, n, bg, music, weather, chapter, card, shake, flash, pulse, add, aloof, set, jump, route, iff, menu, opt } = VN;

  const h1 = (s) => s.hist.p1;

  /* ------------------------------------------------------------ recap helpers */
  function recapOpen(s) {
    switch (h1(s)) {
      case "ending_romance":
      case "ending_true":
        return ["Two years ago, under a lantern-lit sky, you told Uraraka how you felt, and she stayed.",
                "You don't know where she is tonight. That's the part that's been keeping you up."];
      case "ending_falcon":
        return ["Two years ago, it was Falcon who became the person you told things to first.",
                "You haven't seen him since the evacuation split the city in half. You still check every crowd for him anyway."];
      case "ending_friends":
        return ["Two years ago, you left school with a friend group that felt unbreakable, even without any grand confessions.",
                "Unbreakable turned out to be a strong word for what the world had planned."];
      case "ending_lonely":
        return ["Two years ago, you drifted out of that friend group quietly, the way you drift out of most things.",
                "You've had a lot of time since then to regret how that went. More time than you wanted."];
      default:
        return ["It's been two years since you've spoken to most of them. The world gave everyone a good reason to lose touch.",
                "You don't know exactly who's still out there. You're about to find out."];
    }
  }

  function urarakaReturn(s) {
    const e = h1(s);
    if (e === "ending_romance" || e === "ending_true")
      return ["She steps out into the light and every ounce of caution drops out of her posture at once. “Cody—” It's barely a whisper, like she's spent two years rationing the right to say your name out loud.",
              "“I looked for you. I didn't stop looking. I need you to know that.”"];
    if (e === "ending_falcon")
      return ["She steps out into the light, and there's real relief on her face, tempered by something more careful. “Cody. You're alive. I wasn't sure I'd get to say that to you again.”",
              "“I heard Falcon might be with you. I'm glad. I'm glad you weren't alone out here.”"];
    if (e === "ending_lonely")
      return ["She steps out into the light and stops further back than the others did, reading the distance in your shoulders before you've said a word.",
              "“Cody. It's really you.” A pause, careful, testing the ground. “I didn't know if you'd want me to come any closer.”"];
    if (e === "ending_friends")
      return ["She steps out into the light, older, wearier, unmistakably herself. “Cody... I wasn't sure I'd ever get to find out what happened to any of you.”",
              "“You all stayed together. Of course you did.” There's a smile in it, and something that aches."];
    return ["She steps out into the light, older, wearier, unmistakably herself. “...Cody?” Like she's not fully willing to believe it yet either.",
            "“I've been following rumors of a group for a week. I didn't let myself hope it was actually you.”"];
  }

  /* ================================================================ CHAPTER 1 */
  L("p2_start",
    card({ part: 2, title: "Ashfall", sub: "The world ended quietly. What's left of it is still worth fighting for." }),
    bg("ruined_city"), music("ruin"), weather("ash"),
    chapter("Chapter 1", "Two Years Gone"),
    n("The virus didn't end the world. It just made room for whatever came after it — the blackouts, the borders that stopped meaning anything, the slow understanding that no one was coming to fix this.",
      "Somewhere in the second year, people started calling the strange new abilities that showed up in some survivors 'Flares.' Nobody agreed on why. Nobody had the luxury of studying it properly."),
    n(s => recapOpen(s)[0], s => recapOpen(s)[1]),
    n("What's left of downtown is quiet in the specific way ruins are quiet — wind through broken glass, a city's worth of silence with nobody left to fill it.",
      "You're twenty years old, carrying less than you'd like and more than you can afford to lose, walking toward the one address you still remember by heart."),
    say("joseph", "...Cody? If that's actually you and not my brain finally giving out, say something before I throw a brick at you."),
    say("cody", "Please don't throw the brick. It's me. Somehow."),
    n("Joseph looks older in the way everyone does now — leaner, more careful, a scar over one eyebrow that has a story he clearly isn't in a hurry to tell.",
      "Behind him, unmistakably, Cementoss straightens up from where he'd been sitting so still you mistook him for rubble."),
    say("cementoss", "You're late.", "We've been holding this block for three weeks. Glad you didn't make us do it for nothing."),
    n("Which, from him, is the same as a hug."),
    n("Two years compress into a handful of seconds — everything you want to ask, all at once."),
    menu(
      opt("\"Tell me everything. Where's everyone else?\"", { fx: { fri: 2 } },
        say("joseph", "Falcon's alive, last we heard, holed up somewhere west. Uraraka—", "He hesitates. We lost track of her after the evacuation split the highway. We're trying not to assume the worst.")),
      opt("\"I'm just glad you two are alive.\" (Keep it simple.)", { fx: { fri: 1 } },
        say("cementoss", "Simple is underrated. We're alive. That's most of the sentence that matters today.")),
      opt("Stay quiet a moment — it's a lot to process.", { aloof: 1 },
        n("Joseph doesn't push. He just claps a hand on your shoulder and lets the silence sit there with you."),
        say("joseph", "Yeah. I know. Take the second you need."))
    ),
    n("They've made a kind of home out of a half-collapsed parking structure two blocks over — not comfortable, but defensible, and after two years those are close to the same word.",
      "There's a supply run planned for tomorrow, out toward the old school district. You're going, whether you're ready or not."),
    jump("p2_ch2")
  );

  /* ================================================================ CHAPTER 2 */
  L("p2_ch2",
    bg("hallway_ruined"), music("ruin"), weather("dust"),
    chapter("Chapter 2", "What the School Kept"),
    n("The hallway looks smaller than you remember, the way places from childhood always do, half its ceiling tiles down and a tree root pushing up through the floor near the lockers.",
      "It's also, against all odds, mostly untouched — looters tend to skip schools once the vending machines are empty."),
    say("joseph", "Nurse's office still has supplies, if the lock held. You remember which one that was, right?"),
    n("Down the hall, past the lockers, a shape shifts in the shadow of the stairwell — could be nothing. Could be someone who doesn't want to be found."),
    menu(
      opt("Investigate the movement yourself.", { fx: { fri: 1 }, set: { cat: true } },
        n("You edge toward the stairwell, and the shape resolves into nothing more sinister than a stray cat, unbothered, sitting on a pile of old textbooks like it pays rent here."),
        n("It looks at you. You look at it. Somewhere in that exchange, a contract is signed."),
        say("cody", "Small mercies. I'll take them.")),
      opt("Call out to it — announce yourselves rather than sneak.", { fx: { fal: 1 }, set: { cat: true } },
        say("cody", "We're not here for trouble!"),
        n("Your voice echoes down a hallway built for exactly that kind of announcement. Nothing answers back except the cat that darts out from the stairwell, offended by the noise, and then — slowly — returns to inspect your shoes.")),
      opt("Ignore it and focus on the supply run.", { aloof: 1 },
        n("You let it go and keep moving. Whatever it was, it doesn't follow, and the nurse's office lock gives way to Joseph's crowbar without much of a fight."))
    ),
    n("Bandages, a few unexpired bottles of antiseptic, one intact flashlight — a good haul, by current standards.",
      "On the way out, you pass the courtyard doors. The cherry tree out there has kept growing without anyone to watch it. It's the tallest thing left on the block."),
    jump("p2_ch3")
  );

  /* ================================================================ CHAPTER 3 */
  L("p2_ch3",
    bg("home_ruined"), music("sorrow"), weather("dust"),
    chapter("Chapter 3", "What's Left of Home"),
    n("The detour wasn't on the plan. You took it anyway.",
      "Your old street survived better than most — a few houses standing, including, improbably, yours. The door's already broken in. You go in regardless."),
    say("cody", "Dust, water damage, a bookshelf collapsed into itself. The window you used to climb out of is boarded from the outside — someone else's caution, not mine.",
      "It's smaller than I remember. It still, somehow, smells faintly like it used to."),
    n("There's a shoebox half-buried under the wreckage of the desk, the corner of it recognizable even under two years of dust."),
    menu(
      opt("Open it. Whatever's inside, you want to know.", { fx: { fri: 1, ura: 1 }, set: { foundNote: true } },
        n("Photos, mostly — the rooftop, the courtyard, a blurry shot of Falcon mid-laugh that nobody ever meant to keep this long."),
        n("And near the bottom, a folded note in handwriting you'd recognize anywhere: Uraraka's. It's short, undated, and it isn't a goodbye — it reads like she meant to come back and finish the thought in person."),
        iff(s => h1(s) === "ending_falcon",
          [n("Beneath it, a torn scrap of notebook paper in Falcon's chicken-scratch: *Wherever you are, I owe you a rematch. Don't die. That's the rule. — F.*")]),
        n("You don't know when she wrote it. You know exactly how much you need it to still be true.")),
      opt("Leave it. Some things are better left buried.", { aloof: 1 },
        say("cody", "You leave the box where it is. Some rooms are memorials whether you excavate them or not, and you've got a longer walk ahead of you than you have time to grieve properly."),
        n("You close the door behind you anyway, quietly, like it still matters."))
    ),
    n("Joseph waits outside without asking what you found. That's its own kind of kindness."),
    say("joseph", "There's a gas station two miles out that's supposedly still got a generator running. Worth the walk, if you're up for it."),
    jump("p2_ch4")
  );

  /* ================================================================ CHAPTER 4 */
  L("p2_ch4",
    bg("gas_station"), music("tense"), weather("rain"),
    chapter("Chapter 4", "Fuel Stop"),
    n("Rain, the kind that shows up sideways, and one working light under the station awning throwing everything else into deeper black.",
      "There's someone already there — crouched by the pumps, tools spread out, entirely too calm for someone alone in the open after dark."),
    say("maki", "If you're here to fight me for the generator, I should mention I've had a very long week and very little patience left in it.",
      "She doesn't look up right away. When she does, there's a controlled readiness in it — someone who has done this exact stand-off before and won."),
    n("She's sizing up your group the way you're sizing up her. Three strangers and a working generator is either a trade or a fight, and she seems willing to let you pick which."),
    menu(
      opt("Offer to trade supplies for a share of the fuel.", { fx: { maki: 2 } },
        say("cody", "We've got antiseptic, some canned goods. Not looking for a fight — just a fair split."),
        say("maki", "She studies you a second longer, then relaxes, just slightly. Fair's rarer than fuel these days. Deal.")),
      opt("Ask her name and story first — build trust before business.", { fx: { maki: 2, fri: 1 } },
        say("cody", "Before we get into pump logistics — who are you, and what's a Company 8 soldier doing running solo generator maintenance in the rain?"),
        say("maki", "She's surprised enough by the actual question that some of the guard drops. Solo's not by choice. My unit scattered eight months ago. This generator's the closest thing I've got to a mission left.")),
      opt("Keep your distance and let Cementoss do the talking.", { fx: { maki: 1 }, aloof: 1 },
        say("cementoss", "We're not looking for trouble. Name's Cementoss. We can talk terms, or we can all stand in the rain a while longer."),
        say("maki", "She relaxes for him faster than she would have for a stranger — there's a soldier's instinct that recognizes another steady one."))
    ),
    say("maki", "Maki Oze. Used to be Company 8. Fire Force, if that means anything to you anymore. She sticks out a hand, grease and all."),
    n("The trade goes smoother than expected. By the time the rain lets up, Maki's rolling a second fuel can toward your group without being asked."),
    say("maki", "Where are you headed next?", "It's in the specific tone of someone deciding whether to invite herself along."),
    jump("p2_ch5")
  );

  /* ================================================================ CHAPTER 5 */
  L("p2_ch5",
    bg("forest"), music("hope"), weather("fireflies"),
    chapter("Chapter 5", "The Green Mile"),
    n("The forest west of the city is the first place in days that doesn't look wounded. Light comes down through the canopy in long gold columns, and for a few hundred yards, the world remembers what it used to be.",
      "Maki's come along, half invited and half self-appointed. It's not clear yet which of those it actually is."),
    n("A whistle cuts through the trees — three short notes, a code that used to mean something specific on a rooftop a long time ago."),
    say("falcon", "You're all somehow worse at stealth than you were two years ago, which I did not think was possible.",
      "He steps out from behind a fallen trunk like he's been tracking you for the last mile, which, knowing him, he probably has."),
    n("He looks harder around the eyes than you remember. The glasses are taped at one hinge. But the grin's exactly the same."),
    menu(
      opt("Pull him into a hug before he can deflect with another joke.", { fx: { fal: 3 } },
        n("He lets the hug happen for exactly three seconds before shoving you off, suspiciously bright-eyed."),
        say("falcon", "Okay, don't get sentimental on me. I only just found you people again.")),
      opt("Trade the joke back — meet him exactly where he is.", { fx: { fal: 2, fri: 1 } },
        say("falcon", "There they are. Good. I was worried you'd all changed too much to still be fun. I've had two years of nobody to properly insult.")),
      opt("Ask, seriously, if he's okay.", { fx: { fal: 2 } },
        n("The grin falters for just a second before he catches it."),
        say("falcon", "...Ask me again after we're not standing in a forest that might have Flare wildlife in it. I'll give you a real answer. Promise."))
    ),
    say("falcon", "There's a compound not far from here — old research campus, mostly. People are calling it the Hideout. Word is somebody's running the place who actually has answers about the Flares.",
      "Also word is he's not exactly a boy scout about it. Your call whether that's worth the walk."),
    n("Five of you now, which feels like an army after two years of counting on one hand. The Hideout is half a day's walk north.",
      "You make camp first. Nobody argues about going; answers are worth more than caution, most days. But nobody argues about resting either."),
    jump("p2_ch5b")
  );

  /* new scene: the night watch */
  L("p2_ch5b",
    bg("forest_dusk"), music("night"), weather("fireflies"),
    chapter("Night", "The Watch"),
    n("Camp. Joseph and Cementoss asleep back to back, like they've done this every night for two years, which they have. Maki sits at the edge of the firelight, awake, pretending she isn't.",
      "You take the first watch. A few minutes later, so does Falcon."),
    say("falcon", "Don't look at me like that. I'm *volunteering*. I'm a team player now."),
    say("falcon", "Two years, you know. Just me and a lot of walking. I found a Switch once in a flooded game store. Battery was dead. I carried it for four months anyway."),
    say("cody", "Why?"),
    say("falcon", "Because every time I got tired, I'd think: someone's going to want to know I carried this. Optimism's a hell of a drug."),
    n("He's laughing at himself. It's the old laugh. But there's an edge under it, like he's checking whether it still holds weight."),
    menu(
      opt("Tell him you're glad he stayed funny.", { fx: { fal: 2 }, set: { nightWatch: "fal" } },
        say("falcon", "...Yeah. Me too. I was scared that'd be the first thing to go."),
        n("He doesn't say anything else for a while. You don't either. It's the best conversation you've had in two years.")),
      opt("Ask what he's afraid of now.", { fx: { fal: 3 }, set: { nightWatch: "fal" } },
        say("falcon", "Honestly? Being the only one left who remembers the dumb stuff. The glue gun. The goldfish. If it's just me, does it count?"),
        say("cody", "It counts. And it's not just you."),
        say("falcon", "...Good. Say that again tomorrow. I'll need it.")),
      opt("Check in on Maki instead — she hasn't spoken in an hour.", { fx: { maki: 2 }, set: { nightWatch: "maki" } },
        n("You cross the firelight. Maki doesn't turn her head."),
        say("maki", "I don't need to be handled."),
        say("cody", "I'm not handling you. I'm sitting. It's a free fire."),
        n("A long pause. Then she scoots over six inches, which, from her, is practically a handshake.")),
      opt("Take the whole watch alone. Let him sleep.", { aloof: 1, set: { nightWatch: "alone" } },
        n("You nudge him toward his bedroll. He looks at you, then at the dark, then — to your surprise — goes. By dawn you've watched the whole forest breathe, and it's lonelier than you thought it would be."))
    ),
    jump("p2_ch6")
  );

  /* ================================================================ CHAPTER 6 */
  L("p2_ch6",
    bg("hideout"), music("tense"), weather("dust"),
    chapter("Chapter 6", "The Ledger"),
    n("The compound's front half is rubble, deliberately left that way — camouflage, you realize, once you're inside and the back half turns out to be intact, wired, and very much alive.",
      "Screens bank the far wall, throwing pale light across a room someone's clearly been living and working in for a long time."),
    say("light", "You're the group Falcon mentioned.",
      "A young man rises from behind the desk, unbothered by five strangers walking into his space, smiling like he already knows how this conversation ends."),
    say("light", "Light Yagami. I'd say welcome, but I don't think either of us believes I mean it unconditionally yet."),
    say("light", "He gestures to the screens — names, locations, data scrolling past faster than should be readable. I keep a ledger. Everyone still alive in a hundred miles, roughly, and everyone who stopped being a problem for the people trying to survive here.",
      "That second category is smaller than you'd expect. I'm efficient."),
    n("It's the kind of statement that's supposed to unsettle you. Judging by his expression, he'd consider it a failure if it didn't."),
    menu(
      opt("\"What happens to the people in that second category?\" (Push for the truth.)", { fx: { light: 1 } },
        say("light", "Depends on the person. Some relocate. Some stop being dangerous on their own terms. He says it without flinching, which is somehow more unsettling than if he had.",
          "I don't expect you to approve. I expect you to notice that this sector hasn't had a raid in four months.")),
      opt("Offer information in exchange for his — build a working alliance.", { fx: { light: 3 } },
        n("You lay out what you know — the gas station, the school, the shapes moving through downtown. He listens like he's cross-referencing it against something only he can see."),
        say("light", "Useful. I don't extend that word to many people. Consider it the start of a working relationship.")),
      opt("Refuse to engage with the ledger at all. It's not how you want to survive.", { fx: { fri: 1 } },
        say("light", "Your objection is noted and, respectfully, unnecessary. I don't need your approval to keep this sector functional. I'd just prefer your cooperation to your suspicion."),
        n("Cementoss, beside you, doesn't look convinced either way. Neither do you."))
    ),
    /* new: the water-depot dilemma — sets lightStance, read in Part III */
    pulse("#a52a2f"),
    n("A screen flickers. A cluster of red dots at a spot labeled WATER DEPOT."),
    say("light", "Raiders. Fourteen of them. They took the depot three days ago. Two are under twelve — they came with the group. I can resolve this by morning, cleanly. Or you can take the long way."),
    say("light", "Your call. You're a stakeholder now."),
    menu(
      opt("\"Take the long way. We'll talk to them.\"", { fx: { fri: 1 }, set: { lightStance: "defied" } },
        say("light", "Noble. Slow. Fine — I'll log it as an experiment."),
        n("He doesn't sound annoyed. He sounds, strangely, curious, like he's watching a method he's never tried.")),
      opt("\"Do what you have to. Quietly.\"", { fx: { light: 3 }, set: { lightStance: "allied" } },
        say("light", "Good. Efficient."),
        n("Something cold settles into your chest and stays there. You tell yourself it's the air-conditioning. The compound doesn't have air-conditioning.")),
      opt("\"I don't want to know how.\"", { aloof: 1, set: { lightStance: "looked-away" } },
        say("light", "Of course. Plausible distance. I'll take care of the knowing for both of us."),
        n("It's a kindness. It's also a leash. You can't tell which one he meant."))
    ),
    n("The smile drops entirely, for the first time."),
    say("light", "There's something else you should know before you leave. There's a name in my ledger that keeps resurfacing near your old neighborhood. Tomura Shigaraki. He's not the one you need to worry about — he's just the one loud enough to notice.",
      "The name behind him is the actual problem."),
    jump("p2_ch7")
  );

  /* ================================================================ CHAPTER 7 */
  L("p2_ch7",
    bg("rooftop_garden"), music("hope"), weather(null),
    chapter("Chapter 7", "What Still Grows"),
    n("Someone, somewhere in the last two years, decided a rooftop garden was worth defending, and against every reasonable expectation, it's still here — tomato vines climbing a rusted railing, herbs in cracked planters, a city's worth of quiet held together by stubbornness.",
      "It's the same rooftop. You'd know it anywhere."),
    say("joseph", "Found this place about a year ago. Figured if we ever needed one good memory to stand in before doing something stupid, it should be here.",
      "So. Tomorrow we're doing something stupid. Tonight, let's not."),
    n("The sky does the thing it always does up here, orange bleeding into blue like it's the one thing that never got interrupted."),
    menu(
      opt("Find a quiet moment to talk about Uraraka.", { fx: { ura: 2 }, set: { gardenTalk: "ura" } },
        n("You tell Joseph and Cementoss about the note. Neither of them treats it lightly."),
        say("cementoss", "We'll find her. That's not optimism. That's a plan.")),
      opt("Spend the evening with the whole group — no separating off.", { fx: { fri: 2, fal: 1, maki: 1 }, set: { gardenTalk: "all" } },
        n("For one evening, nobody talks about the Hideout, or the ledger, or the name Light said to worry about. You eat garden tomatoes that taste like something out of a different life, and it's enough."),
        say("falcon", "And now, on the rooftop, we observe the common pigeon in its natural habitat — which is, apparently, a post-apocalyptic garden."),
        n("Nobody stops him.")),
      opt("Pull Maki aside — she's still holding herself apart from the group.", { fx: { maki: 2 }, set: { gardenTalk: "maki" } },
        say("maki", "I'm used to a chain of command. This is — looser. Warmer. I don't entirely know what to do with warmer."),
        say("maki", "I'm working on it.", "And for once it sounds like she means to.")),
      opt("Help Cementoss fix the railing. He hasn't said a word about himself yet.", { fx: { fri: 2 }, set: { gardenTalk: "cementoss" } },
        n("You hold the brace while he tightens the bolt. For a long while he says nothing, and then, without looking up:"),
        say("cementoss", "Three weeks, the first winter. A parking structure came down around us. I held the ceiling for eleven minutes so Joseph could get through. I don't tell him that."),
        say("cementoss", "He thinks the ceiling just... held. I'd like him to keep thinking that."),
        n("You nod, and tighten the other bolt, and keep it between the railing and you."))
    ),
    n("Nobody sleeps much. Tomorrow you're walking back toward the courtyard, toward whatever Shigaraki's been circling, toward the name behind him.",
      "Tonight, at least, the garden holds."),
    jump("p2_ch8")
  );

  /* ================================================================ CHAPTER 8 */
  L("p2_ch8",
    bg("courtyard_ruined"), music("tense"), weather("ash"),
    chapter("Chapter 8", "Under the Same Tree"),
    n("The courtyard's gone wild — grass to your knees, the cherry tree enormous and unbothered by any of it, petals from a season nobody was around to enjoy scattered across broken pavement.",
      "Someone's already waiting under it. Not who you were hoping for."),
    say("shigaraki", "Five of you. He said you'd bring friends. He's usually right about that kind of thing.",
      "Shigaraki doesn't bother standing up straight, examining his own hand like it's more interesting than you are."),
    say("shigaraki", "I was told to make an impression. So — consider this a warning, not an invitation. Turn around."),
    n("The tension in the group is immediate, five sets of instincts pulling in slightly different directions at once."),
    menu(
      opt("Stand your ground — refuse to leave the courtyard.", { fx: { fri: 1 } },
        say("cody", "This tree's older than whatever you're working for. We're not turning around."),
        n("Shigaraki actually laughs at that — short, surprised, almost fond."),
        say("shigaraki", "Bold. Stupid. Noted."),
        n("He doesn't attack. Not yet. He just watches, like he's deciding whether you're worth the effort.")),
      opt("Try to talk him down — he doesn't seem fully committed to this.", { fx: { light: 1 }, set: { sparedShigaraki: true } },
        say("cody", "You said 'he told you' twice now. That's not a man giving orders to someone loyal. That's a man giving orders to someone he hasn't convinced."),
        n("For a second, something flickers across Shigaraki's face — not agreement, exactly, but recognition."),
        say("shigaraki", "...You talk too much."),
        n("He doesn't press the attack.")),
      opt("Signal the group to retreat and regroup instead.", { fx: { maki: 1 }, aloof: 1 },
        n("You fall back in a tight formation, Maki covering the retreat like she's done it a hundred times, which, evidently, she has."),
        say("shigaraki", "Smart. Wish more people were. He sounds almost disappointed."))
    ),
    n("Whatever this was, it wasn't the real fight. It was a name-check, a warning shot, a door left deliberately ajar.",
      "Beyond the tree, past the wrecked fence line, the shape of something much larger is waiting — patient, in the way only something that's already won several times can afford to be."),
    n("A branch snaps somewhere behind the tree line — not Shigaraki's careless kind of noise, something more deliberate, someone who learned a while ago how to move quietly and is choosing not to, on purpose, right now."),
    say("uraraka", s => urarakaReturn(s)[0], s => urarakaReturn(s)[1]),
    n("Two years condensed into the space between the tree line and where you're standing. She's close enough now that you can see her deciding whether to run the rest of it or walk."),
    menu(
      opt("Close the distance yourself — don't make her cross it alone.", { fx: { ura: 3 }, set: { confessed: true, reunited: true } },
        n("Whatever she was going to say gets lost somewhere in the hug. It doesn't matter. You both know the shape of it anyway."),
        say("uraraka", "I heard a rumor about a group holding a courtyard with a cherry tree in it. I had a feeling it might be you idiots.")),
      opt("Hold back — too much has happened to just pick up where you left off.", { fx: { ura: 1 }, set: { reunited: false } },
        n("You hold your ground, and something in her expression flickers — hurt, maybe, or just tired recognition. She stops a few feet short."),
        say("uraraka", "Fair. Two years is a long time to expect anything to still fit the way it used to. I'm glad you're alive, Cody. That part, at least, hasn't changed."))
    ),
    jump("p2_climax")
  );

  /* ================================================================ CLIMAX */
  L("p2_climax",
    chapter("Climax", "The Name Behind Him"),
    n("He doesn't announce himself. He doesn't need to. The air changes first, the specific quiet that means something enormous just decided to pay attention to you."),
    flash("#fff"),
    say("allforone", "All of this — was never really about a virus. That was just the crack in the door. What came through it was opportunity.",
      "Power finds the cracks in everything eventually. I simply got there first."),
    say("allforone", "You've built something interesting here — a little coalition, a ledger-keeper, a soldier, a found family holding onto a rooftop garden like it means something.",
      "I'm curious what you think that's worth, against what I've already taken."),
    n("Everyone's looking at you. Not because you're the strongest one here — you aren't, not by a wide margin — but because two years of choices led every one of them to this courtyard, together, and that has to count for something."),
    menu(
      opt("Stand with everyone you've rebuilt trust with — friendship, love, alliance, all of it, together.", { fx: { fri: 2, ura: 1 }, set: { p2path: "unity" } },
        say("cody", "It's worth everything. You took the world. You don't get to take this too."),
        n("Five people who two years ago were just trying to survive a school festival stand between a would-be tyrant and the last stubborn cherry tree in the city. It shouldn't be enough. It has to be.")),
      opt("Fall back on Light's methods — use the ledger's leverage, cold and effective.", { fx: { light: 3 }, set: { p2path: "light" } },
        n("You think of the ledger, the names, the sector that hasn't had a raid in four months. Some kinds of order cost something to keep. You decide it's worth paying."),
        say("cody", "You're not the only one who learned how to be efficient."),
        n("For the first time, All For One looks something like interested.")),
      opt("Pull just your closest people out of the fight entirely. Survival first.", { fx: { fal: 2 }, set: { p2path: "quiet" } },
        n("You look at the people who followed you this far — the ones who are still soft in the ways that matter, the ones you can't afford to spend on a fight this size."),
        say("cody", "Not like this."),
        n("You start walking the ones you love most back toward the tree line, away from a war that was never fully yours to finish."))
    ),
    route(s => resolveEnding2(s))
  );

  function resolveEnding2(s) {
    const { ura, fri, fal, maki, light } = s.stats;
    const f = s.flags;
    if (s.aloof >= 5 || (fri < 4 && ura < 4 && fal < 4 && maki < 3)) return "end_longdark";
    if (f.p2path === "light") return "end_staticledger";
    if (f.p2path === "quiet") return "end_embers";
    if (f.p2path === "unity" && f.confessed && fri >= 9 && ura >= 7 && maki >= 4 && light <= 5) return "end_inheritance";
    return "end_ashfalldawn";
  }
  VN.resolveEnding2 = resolveEnding2;

  /* ================================================================ ENDINGS (Part II) */
  VN.ending("end_inheritance", {
    part: 2, kind: "true", bg: "courtyard_sunset", music: "hope", weather: "petals",
    title: "Inheritance", hint: "Stand together — with Uraraka, your friends and Maki — and leave the ledger closed.",
    summary: "Everything you rebuilt, together, intact.",
    lines: [
      "This is the version where two years of scattered, stubborn choices finally add up to something whole — the friend group intact, Uraraka's hand back in yours, Maki folded into the family she didn't know she needed, and Light's ledger left unopened, unused, a temptation you didn't require.",
      "All For One doesn't win this courtyard. He doesn't lose it cleanly either — but for the first time since the pandemic cracked the world open, something pushes back against him with more than desperation behind it.",
      "The cherry tree is still standing at the end of it. So, improbably, impossibly, are all of you. That's not a small ending. That's the only kind worth having.",
    ],
  });
  VN.ending("end_ashfalldawn", {
    part: 2, kind: "good", bg: "ruined_dawn", music: "hope", weather: "ash",
    title: "Ashfall Dawn", hint: "Stand together — but don't quite earn everyone's full trust.",
    summary: "Nobody left behind. Nothing cleanly won.",
    lines: [
      "You don't win cleanly, and you don't win completely — All For One retreats rather than falls, and the sector remains contested, dangerous, unfinished.",
      "But the group that walks out of the courtyard is the same group that walked in, nobody left behind, nobody sacrificed for expedience. In this world, that's closer to a miracle than it should be.",
      "The sun comes up gray and smoke-streaked over the ruins, same as every morning for two years. This time, for once, you're glad to see it.",
    ],
  });
  VN.ending("end_staticledger", {
    part: 2, kind: "neutral", bg: "hideout_alert", music: "tense", weather: "dust",
    title: "Static Ledger", hint: "Use Light's leverage against All For One.",
    summary: "It worked. It cost you something.",
    lines: [
      "You use everything Light gave you access to — every name, every leverage point, every cold advantage a ledger like that can buy. It works. All For One's grip on the sector breaks, fast and clean and undeniable.",
      "It costs you something you don't fully clock until later — a certain warmth in how the others look at you now, a distance that wasn't there before. Effective and beloved turned out to be a choice, not a package deal.",
      "You kept everyone alive. You're not sure, some nights, if you kept all of yourself in the process.",
    ],
  });
  VN.ending("end_embers", {
    part: 2, kind: "neutral", bg: "forest_dusk", music: "sorrow", weather: "fireflies",
    title: "Embers", hint: "Walk away from the fight, with the people closest to you.",
    summary: "The small life, chosen with open eyes.",
    lines: [
      "You don't stay for the fight. You take Falcon, and whoever else will come, and you walk back into the trees where the light still comes down gold instead of gray.",
      "\"We're allowed to choose the small life,\" Falcon says, not quite a question, like he needs you to agree with him out loud. You do.",
      "The war for the city continues without you. Somewhere behind you, a found family plants a garden that has nothing to do with saving the world, and everything to do with saving each other.",
    ],
  });
  VN.ending("end_longdark", {
    part: 2, kind: "bad", bg: "hideout", music: "sorrow", weather: "dust",
    title: "The Long Dark", hint: "Keep your distance, again and again.",
    summary: "Surviving alone isn't the same as living.",
    lines: [
      "Somewhere between the reunion and the courtyard, you kept choosing distance — a fair instinct, once, that never quite recalibrated for a world where distance is the one thing nobody can afford anymore.",
      "When the moment in the courtyard finally arrives, you're the one standing furthest from everyone else, and it shows in exactly the ways you were afraid it would.",
      "The others survive. You do too, technically. But surviving alone in a world this empty isn't the same as living, and two years from now you'll still be trying to work out when exactly you let that distance win.",
    ],
  });
})();
