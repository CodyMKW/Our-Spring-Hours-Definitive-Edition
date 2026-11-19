/* ============================================================================
   PART I — OUR SPRING HOURS
   Stats: ura (Uraraka), fri (Joseph & Cementoss), fal (Falcon); aloof counts
   withdrawn choices. Flags set here (and read by Parts II/III):
     helpedPapers  you dropped everything to help Uraraka on day one
     partner       "uraraka" | "falcon" | "friends"   (festival booth partner)
     wishWho       "uraraka" | "falcon" | "friends"   (who you wrote your lantern wish with)
     p1route       "ura" | "fal" | "fri" | "alone"    (who you ended up with on festival night)
     confessed     you told Uraraka how you feel
     falconSincere you told Falcon he matters to you, plainly
     pact          you proposed the "rooftop every Saturday" pact
   ========================================================================== */
(function () {
  "use strict";
  const { L, say, n, bg, music, weather, chapter, card, wait, add, aloof, set, jump, route, iff, menu, opt, flash } = VN;

  /* ======================================================================= PROLOGUE */
  L("p1_start",
    card({ part: 1, title: "Our Spring Hours", sub: "Four friends. One rooftop. A whole semester of choices." }),
    bg("hallway"), music("spring"), weather("dust"),
    chapter("Prologue", "A Tuesday Like Any Other"),
    n("The hallway smells like floor wax and cut grass drifting in through a propped-open window.",
      "Senior year, second semester. Nothing left to prove and nowhere left to hide.",
      "You're Cody — half a laptop bag, half a to-do list, running on the last granola bar in your locker."),
    say("joseph", "There you are! I've been standing here for a full two minutes looking cool and mysterious and you completely missed it.",
      "Anyway — did you hear? We're getting a transfer student. Today. Second semester. Who does that?"),
    say("cody", "Bold of them to walk into a school where all the friend groups already have load-bearing inside jokes."),
    say("joseph", "Word is she's in our class. C'mon, don't you want to know literally anything about her?"),
    menu(
      opt("\"Not really my business.\"", { aloof: 1 },
        say("joseph", "Wow. Cool. Very Cody of you."),
        n("He says it like an insult. It might be one.")),
      opt("\"Okay, fine — you have my attention.\"", { fx: { ura: 1 } },
        say("joseph", "There he is."),
        n("He grins like he's already planning something. That's never a good sign.")),
      opt("\"Only if it comes with snacks.\"", { fx: { fri: 1 } },
        say("joseph", "You'd trade world peace for a vending-machine snack, I swear."))
    ),
    say("joseph", "Falcon's already running a betting pool on how long she lasts. I put my money on 'forever.' C'mon — homeroom."),
    jump("p1_ch1")
  );

  /* ================================================================ CHAPTER 1 */
  L("p1_ch1",
    bg("courtyard_day"), music("spring"), weather("petals"),
    chapter("Chapter 1", "Under the Cherry Tree"),
    n("Lunch, and the courtyard tree is doing its one job spectacularly: raining pink on everyone who walks under it.",
      "Someone's crouched at the base of it, scooping a dropped stack of papers back into a folder before the wind can finish the job."),
    say("uraraka", "Oh — no no no, stay still, little wind, we're not doing this today—"),
    n("She's losing the argument with the wind. Badly."),
    menu(
      opt("Drop your bag and help her catch the papers.", { fx: { ura: 2 }, set: { helpedPapers: true } },
        n("You're already on one knee scooping up loose-leaf before you've fully decided to."),
        say("cody", "Got most of it. One page tried to make a break for the fence, but I don't think it's built for cross-country."),
        say("uraraka", "She looks up, cheeks pink from more than just the wind, and beams like you've done something far more heroic than pick up paper.",
          "Thank you! I'm Uraraka — I just transferred in. First day, and I'm already losing fights to weather.")),
      opt("\"Need a hand?\" — but stay standing, playing it cool.", { fx: { ura: 1 } },
        say("cody", "Need a hand?"),
        n("You offer it hands-in-pockets, radiating the specific calm of someone who is definitely also panicking a little."),
        say("uraraka", "Yes! Please! — okay, you can stand there, but you're holding the folder. I'm Uraraka. New here as of about forty minutes ago.")),
      opt("Let Joseph handle it; you hang back.", { aloof: 1 },
        n("Joseph's already sliding in like it's a rescue mission, gathering pages two at a time."),
        say("joseph", "Cody, a little help? Or are you just going to supervise?"),
        say("uraraka", "She takes the rescued folder from Joseph with a grateful little bow. Thank you both — well, thank *him*, mostly. I'm Uraraka, new here as of about forty minutes ago."))
    ),
    say("cody", "Cody. And in your defense, that wind's been undefeated all week."),
    say("uraraka", "I'm determined to place top of the class by finals, wind cooperation or not. New school, clean slate, full effort."),
    n("She says it lightly, but there's real steel under it — the kind of person who means exactly what she says."),
    music("festival"),
    say("falcon", "Did I hear 'top of the class'? Bold opener for someone who's been here forty minutes."),
    n("Falcon drops onto the bench like he owns it, which, socially, he basically does — brown hair, glasses, a red shirt under a jacket he never zips, and a grin permanently set to *I have a plan and you won't like it.*"),
    say("falcon", "Falcon. Resident schemer, unofficial commentator, occasionally useful. You've met Cody. He's fine. He's load-bearing."),
    n("Falcon's got that look — the one that means he's about to rope someone into something."),
    menu(
      opt("Trade banter with Falcon.", { fx: { fal: 2 } },
        say("cody", "Careful, Falcon, some of us peaked in participation trophies. Don't call attention to the rest of us."),
        say("falcon", "Speak for yourself, I peaked *today*."),
        n("He grins. Uraraka is already laughing, and it's real, not polite.")),
      opt("Keep the conversation on Uraraka.", { fx: { ura: 1 } },
        say("cody", "Top of the class is a good goal. What's the plan — study group, caffeine, spite?"),
        say("uraraka", "Honestly? Mostly spite. It's underrated as a motivator."),
        n("She says it so cheerfully it takes a second to land as a joke.")),
      opt("Try to referee before this becomes a bit.", { fx: { fri: 1 } },
        say("cody", "Let's not scare off the new student on day one, Falcon."),
        say("falcon", "Relax, mediator. I only scare off people who can't take a joke."),
        n("Uraraka, still smiling, does not look scared off."))
    ),
    n("The bell cuts the moment short, the way it always does. Papers get stacked, bags get shouldered, and the courtyard empties in that particular scramble unique to last-minute lunches.",
      "Something about the afternoon feels a half-degree warmer than it did this morning."),
    say("falcon", "Hey — Cody. Kart race. Your place, this week. Bring your A-game and a spare controller. I'm not asking."),
    say("cody", "You're literally asking."),
    say("falcon", "I'm *scheduling*. There's a difference."),
    jump("p1_ch2")
  );

  /* ================================================================ CHAPTER 2 */
  L("p1_ch2",
    bg("home_night"), music("night"), weather(null),
    chapter("Chapter 2", "After Hours"),
    n("Evening. Homework half-open on the desk, laptop glow doing most of the room's lighting.",
      "Your phone sits there, doing the thing phones do where it looks extremely normal until you actually have to decide something."),
    say("cody", "Okay. Text somebody, or don't. Simple."),
    n("It is, somehow, not simple."),
    menu(
      opt("Text Joseph — plan a weekend hangout for the group.", { fx: { fri: 2 }, set: { texted: "joseph" } },
        n("Joseph replies almost instantly, like he was sitting on the phone waiting for exactly this."),
        say("joseph", "ROOFTOP. Saturday. Bring snacks and your excuse for skipping the group chat all week.")),
      opt("Text Uraraka — check how her first day went.", { fx: { ura: 2 }, set: { texted: "uraraka" } },
        n("It takes her a minute to reply — probably still unpacking boxes somewhere."),
        say("uraraka", "It went well! Scary in the normal way, not the bad way. Thank you for asking — that's the nicest thing that's happened to me in a new place in a while.")),
      opt("Text Falcon — rate his 'welcome wagon' plan.", { fx: { fal: 2 }, set: { texted: "falcon" } },
        n("Falcon answers with a photo of a half-built fleet of paper airplanes."),
        say("falcon", "Operation Welcome Wagon. I've drafted fourteen ways to be extremely friendly to the new girl. Rate them. Honestly. I can take it."),
        n("You rate them. All fourteen. It runs until 1 AM and is the best conversation you've had all week.")),
      opt("Close the laptop. Today doesn't need a follow-up.", { aloof: 1, set: { texted: "nobody" } },
        n("You close the laptop. Some days are complete just as they are, no follow-up message required.",
          "It's quiet, and the quiet is fine, even if a small part of you wonders what you'd have said."))
    ),
    n("You turn in early. Tomorrow can have its own opinions about how the week should go."),
    jump("p1_ch3")
  );

  /* ================================================================ CHAPTER 3 (new) */
  L("p1_ch3",
    bg("home_day"), music("spring"),
    chapter("Chapter 3", "Midterm Mayhem"),
    n("Thursday. Midterms are Monday, and somehow your room has become the study group's headquarters.",
      "Not by plan. These things just happen when Uraraka shows up with color-coded flashcards and Falcon shows up with a second controller."),
    say("uraraka", "Okay. Chemistry first, then history, then — Falcon, put the controller down."),
    say("falcon", "It's not a controller. It's a study aid. For hand-eye coordination."),
    say("uraraka", "That's not a subject."),
    say("falcon", "Not *yet*."),
    n("The door bangs open. Joseph, arms full of snacks, a bag in each hand and one in his teeth."),
    say("joseph", "I come bearing carbs. Do not thank me. Thank the vending machine that took my dollar twice."),
    say("joseph", "Also — rooftop, Saturday. That's not a request. Cementoss is coming. You'll finally meet him."),
    n("Three people, three very different plans for the next two hours, and you're standing in the middle."),
    menu(
      opt("Quiz Uraraka with her flashcards.", { fx: { ura: 2 }, set: { study: "uraraka" } },
        say("cody", "Okay. Hit me with the hard ones."),
        n("She does. She misses one — the half-life question — and her whole face tightens, like it personally insulted her."),
        say("uraraka", "No. Again. I *know* this. Give me — okay. Okay. Half-life. Got it. Got it!"),
        n("There's something genuinely contagious about someone who treats a flashcard like a boss fight.")),
      opt("Take Falcon up on that kart race.", { fx: { fal: 2, ura: 1 }, set: { study: "falcon", kart: true } },
        say("falcon", "Finally! A worthy opponent!"),
        n("You and Falcon spend four glorious minutes in a death-grip on the final lap, each of you shouting increasingly unhinged commentary."),
        n("Then Uraraka, who has been *very* quiet, quietly takes the third controller."),
        say("uraraka", "...I'm only doing this to make you stop talking."),
        n("She wins. Both of you. By a lot. Falcon stares at the screen like it's betrayed him."),
        say("falcon", "I want a rematch. Immediately. In writing.")),
      opt("Be the study group's referee. Make a schedule.", { fx: { fri: 2 }, set: { study: "friends" } },
        say("cody", "Twenty minutes of work, ten minutes of chaos. Rotating. I'm timing it."),
        say("joseph", "Wow, who made *you* the principal?"),
        n("It works, weirdly. Nobody wants to admit it, but it works — and the snacks get distributed with the fairness of a small democracy."))
    ),
    n("By sundown the flashcards are everywhere, the snacks are gone, and Uraraka has somehow convinced Falcon to quiz *her*."),
    say("uraraka", "Okay — same time Saturday? I think I finally understand half-lives."),
    say("joseph", "Saturday is rooftop day. Non-negotiable. You're coming too, new girl."),
    say("uraraka", "...Oh! Um — yes. Okay. Yes."),
    n("She says it like she isn't sure she's allowed to be this happy about a rooftop."),
    jump("p1_ch4")
  );

  /* ================================================================ CHAPTER 4 */
  L("p1_ch4",
    bg("rooftop_sunset"), music("spring"), weather(null),
    chapter("Chapter 4", "Rooftop, Saturday"),
    n("The rooftop access door groans open onto a sky doing its best impression of a fruit stand — orange, red, one stubborn strip of blue holding out at the top.",
      "Joseph's already up there, and beside him, unmistakably, Cementoss — a wall of calm in a maroon hoodie, sitting so still he could be part of the railing."),
    say("cementoss", "You made it.",
      "Joseph talks about you enough that I was starting to think you were fictional."),
    say("joseph", "I do not talk about him *that* much—"),
    n("Cementoss just looks at him. Joseph stops."),
    n("Uraraka comes up the stairs a few minutes later, a little out of breath, clutching a paper bag like a trophy. Joseph cheers for no reason. Cementoss gives her a single, solemn nod — which, from him, is a parade."),
    say("falcon", "Did I miss Cementoss being terrifyingly wise yet? No? Good, don't start without me."),
    n("Falcon arrives fashionably late with a bag of chips he has zero intention of sharing evenly."),
    n("The city hums below, indifferent and enormous. Up here it's just the five of you and a sky that won't stay this color for long."),
    menu(
      opt("Ask Cementoss for advice — about Uraraka, carefully.", { fx: { ura: 2 }, set: { askedCementoss: "ura" } },
        say("cody", "Hypothetically, if a person liked someone they just met—"),
        n("He doesn't laugh, doesn't tease, just considers it the way he considers everything — slowly, completely."),
        say("cementoss", "Hypothetically, that person should say something true before the moment decides for them. Silence rarely picks the outcome you wanted."),
        n("Across the roof, Uraraka and Falcon are arguing about whether a pigeon counts as a wild animal. You try to look like you weren't asking anything.")),
      opt("Ask Cementoss how he and Joseph even became friends.", { fx: { fri: 2 }, set: { askedCementoss: "fri" } },
        say("cementoss", "He sat next to me at lunch in a school where I knew nobody, and didn't stop talking for three years.",
          "I never asked him to. That's usually how the good ones happen — nobody asks, they just stay."),
        n("Joseph, uncharacteristically quiet for a second, just bumps Cementoss's shoulder with his own. It says more than either of them would out loud.")),
      opt("Just enjoy the view. Not everything needs unpacking.", { fx: { fal: 1 }, set: { askedCementoss: "view" } },
        n("You let the conversation go where it wants — chip-stealing and skyline and Falcon narrating passing pigeons like a nature documentary."),
        say("falcon", "See, this is the good stuff. No drama, no hypotheticals, just snacks and a city on fire."),
        n("It's a sunset. But he's not wrong."))
    ),
    n("The sun finishes its performance and the city lights take over the shift. Nobody's in a hurry to go back downstairs.",
      "Monday feels far away up here. It isn't, but it feels that way."),
    jump("p1_ch5")
  );

  /* ================================================================ CHAPTER 5 */
  L("p1_ch5",
    bg("hallway"), music("festival"),
    chapter("Chapter 5", "Festival Prep"),
    n("Spring festival season, and the hallway bulletin board has exploded into a riot of sign-up sheets and badly-drawn flyers.",
      "Your class is running a booth, which means partners, which means somebody's about to make you choose."),
    say("joseph", "Booth's decided — lantern stall, easy money, easier snacks. Partner sign-up's on the sheet. Don't overthink it."),
    n("You're absolutely going to overthink it. Four names, one pen, one decision that's going to shape the next two weeks."),
    menu(
      opt("Sign up with Uraraka.", { fx: { ura: 3 }, set: { partner: "uraraka" } },
        say("uraraka", "She spots her own name next to yours on the sheet and lights up. Oh — teamwork! I promise I'm better at lanterns than I was at holding onto papers.")),
      opt("Sign up with Falcon.", { fx: { fal: 3 }, set: { partner: "falcon" } },
        say("falcon", "You and me, huh? I've got seventeen bad ideas for this booth and I intend to try all of them.")),
      opt("Sign up with Joseph and Cementoss.", { fx: { fri: 3 }, set: { partner: "friends" } },
        say("cementoss", "Good."),
        n("He says it like the matter is now closed and always was. Joseph fist-pumps loud enough that a teacher looks over."))
    ),
    bg("courtyard_sunset"), weather("petals"), music("spring"),
    chapter("Two Weeks Later", "Booth Night"),
    n("Two weeks of folding paper lanterns, arguing about string lights, and one memorable incident involving a hot glue gun get compressed into a single tired, satisfied evening.",
      "The booth is finished. It looks, against all odds, good."),
    route(s => "p1_partner_" + (s.flags.partner || "friends"))
  );

  L("p1_partner_uraraka",
    say("uraraka", "We actually pulled it off. This is the first thing here that's felt like *mine*. Ours, I mean. Thank you for that."),
    n("She's holding up a slightly crooked lantern like a trophy. The way she says it, quiet and a little surprised at her own honesty, makes the courtyard feel smaller and warmer at once."),
    menu(
      opt("\"It's the best lantern in the building.\"", { fx: { ura: 1 }, set: { complimented: true } },
        say("uraraka", "It is NOT. It's crooked. It's *so* crooked."),
        say("cody", "That's why it's the best one."),
        n("She laughs, and hides it behind the lantern, and doesn't fully succeed.")),
      opt("Tease her about the crooked lantern.", { fx: { fri: 1 } },
        say("uraraka", "Excuse me, this is *artisanal*."),
        n("She bumps your shoulder with hers, and for a second neither of you moves away."))
    ),
    jump("p1_ch6")
  );
  L("p1_partner_falcon",
    say("falcon", "Objectively the best booth in the building. I'm framing this glue-gun scar. It's a war wound now."),
    n("He surveys the wreckage of glitter and glue sticks like a general admiring a battlefield."),
    say("falcon", "You're less insufferable than I expected as a partner. High praise. Don't let it go to your head."),
    menu(
      opt("Start a glitter war. Immediately.", { fx: { fal: 2 } },
        n("You've thrown the first handful before he can say a word. It lands directly in his hair."),
        say("falcon", "That is a *declaration of war*."),
        n("The next ten minutes are the most chaotic and most fun cleanup of your life. The booth gets 40% more sparkly. Nobody is sure how.")),
      opt("Insist you finish the booth properly first.", { fx: { fal: 1, fri: 1 } },
        say("falcon", "You're no fun. ...But yeah. Okay. Let's make it good."),
        n("He steadies the ladder while you hang the last string of lights, and for once, he doesn't say anything clever. He just stays."))
    ),
    jump("p1_ch6")
  );
  L("p1_partner_friends",
    say("joseph", "Team effort! This is the kind of thing you remember in ten years, you know? Not the booth. This part."),
    n("He throws an arm around your shoulder and, by extension, Cementoss's, who tolerates it with the patience of a mountain."),
    menu(
      opt("Thank Cementoss for building the frame.", { fx: { fri: 1 } },
        say("cementoss", "It needed a frame."),
        say("joseph", "He built it in forty minutes and then pretended he'd 'just sort of leaned some boards together.'"),
        say("cementoss", "...It was a little more than leaning.")),
      opt("Ask Joseph what he really meant by 'this part.'", { fx: { fri: 1 } },
        say("joseph", "Just — everyone's going different places after this. I've been trying not to think about it. Failing."),
        say("cementoss", "Then think about it with us, not alone."))
    ),
    jump("p1_ch6")
  );

  /* ================================================================ CHAPTER 6: FESTIVAL NIGHT */
  /* three evening "slots"; each is a menu: spend it with Uraraka / Falcon / the guys */
  L("p1_ch6",
    bg("courtyard_night"), music("festival"), weather("petals"),
    chapter("Chapter 6", "Festival Night"),
    n("The festival arrives loud and lit-up — the courtyard tree strung with lanterns instead of blossoms now, string lights doing their best impression of stars.",
      "The booth is running without you for the evening. For the first time in two weeks, you have nowhere to be, and three different people to be there with."),
    n("Slot one: the food stalls."),
    menu(
      opt("Takoyaki with Uraraka — she's never tried it.", { fx: { ura: 2 } },
        say("uraraka", "Is it supposed to be *this* hot? — No, don't tell me, I'm committed."),
        n("She eats the whole thing, eyes watering, with the fierce dignity of someone in a personal boss fight. When she finishes, she looks at you like you've both survived a war.")),
      opt("An eating contest against Falcon.", { fx: { fal: 2 } },
        say("falcon", "Rules: no stopping, no crying, no *talking*."),
        n("You lose by one skewer. He celebrates like he's won the Olympics, then buys you a drink out of what he calls 'professional courtesy.'")),
      opt("Find Joseph and Cementoss at the dango stall.", { fx: { fri: 2 } },
        say("joseph", "We got you a stick! We got you *three* sticks! Cementoss insisted on counting."),
        say("cementoss", "Three seemed correct."),
        n("It is, objectively, the best dango you've ever had. It may be the company."))
    ),
    n("Slot two: the games."),
    menu(
      opt("Goldfish scooping with Uraraka.", { fx: { ura: 2 } },
        say("uraraka", "The paper is too thin. This is a conspiracy. I'm going to win anyway."),
        n("Four fish later you're both out of paper and she has the biggest grin you've ever seen. She names her goldfish after a chemistry term. You don't ask which one.")),
      opt("The ring toss — Falcon says it's rigged.", { fx: { fal: 2 } },
        say("falcon", "It's rigged. I can *prove* it's rigged. Watch."),
        n("He proves it's rigged by winning anyway, via a technique he calls 'honorable cheating,' and hands you a very small, very smug stuffed bird.")),
      opt("The shooting gallery with Cementoss and Joseph.", { fx: { fri: 2 } },
        n("Cementoss hits every target without apparent effort. The booth owner stares. Joseph howls with laughter."),
        say("joseph", "I have known this man three years and I *still* don't know what he can't do."))
    ),
    n("Slot three: the wish lanterns. The festival's tradition — write a wish, hang it on the tree. Nobody's supposed to read anyone else's."),
    menu(
      opt("Write your wish beside Uraraka's.", { fx: { ura: 2 }, set: { wishWho: "uraraka" } },
        say("uraraka", "No peeking. I mean it. I'll know."),
        n("You don't peek. But when she hangs hers, she stands on her toes to reach the high branch — right next to where you hung yours.")),
      opt("Write yours with Falcon — wishes, but make them ridiculous.", { fx: { fal: 2 }, set: { wishWho: "falcon" } },
        say("falcon", "Mine's a joke. Obviously."),
        n("It isn't. You catch the first line before he flips it over: *'Everyone I know stays.'* He tucks it into the tree before you can say anything. You decide not to.")),
      opt("Write yours with Joseph and Cementoss.", { fx: { fri: 2 }, set: { wishWho: "friends" } },
        n("Joseph writes about three paragraphs. Cementoss writes four words. You count them later; they're the same four words you wrote."))
    ),
    n("The night is getting late. The crowds thin, the lights flicker, and the group scatters into its own errands — for a rare quiet stretch, it's just you and the noise of everyone else's fun."),
    route(s => {
      const f = s.flags, st = s.stats;
      if (s.aloof >= 4 && st.ura < 4 && st.fri < 4 && st.fal < 4) return "p1_night_alone";
      const bonus = (who) => (f.partner === who ? 1 : 0) + (f.wishWho === who ? 1 : 0);
      const u = st.ura + bonus("uraraka"), a = st.fal + bonus("falcon"), r = st.fri + bonus("friends");
      if (u >= a && u >= r) return "p1_night_ura";
      if (a >= r) return "p1_night_fal";
      return "p1_night_fri";
    })
  );

  /* -------------------------------------------------- route: Uraraka */
  L("p1_night_ura",
    set("p1route", "ura"),
    n("A hand catches your sleeve before you can keep walking."),
    say("uraraka", "There you are. I was starting to think you'd been abducted by the takoyaki line.",
      "Walk with me? Just — away from the noise for a minute."),
    bg("rooftop_night"), music("night"), weather(null),
    chapter("Festival Night", "The Roof"),
    n("You end up on the roof again, the festival reduced to a smear of light and sound below. She leans on the railing like she's done it a hundred times, though this is only her third time up here."),
    iff(s => s.flags.helpedPapers,
      [say("uraraka", "You know I still have the page? The one the wind tried to steal on my first day. I kept it. It's in my chemistry notebook. I don't know why I'm telling you that.")]),
    iff(s => s.flags.askedCementoss === "ura",
      [n("*Say something true before the moment decides for you.* Cementoss's voice, as steady as the railing under your hands.")]),
    say("uraraka", "I've had a genuinely good semester, and a big part of that has your name on it. I just wanted you to know that. Whatever you do with it."),
    menu(
      opt("Tell her how you actually feel.", { fx: { ura: 5 }, set: { confessed: true } },
        say("cody", "I like you. Not in the vague, easy-to-take-back way — the specific kind, where I've noticed the exact way you laugh at your own jokes before anyone else does."),
        n("It's out before you can file it under things-to-say-later. There's no taking it back now, and for once, that's the point.")),
      opt("Thank her — and mean it, as a friend.", { fx: { ura: 1, fri: 1 } },
        say("cody", "You've made this semester better too."),
        n("You mean it fully, even if it's not the whole sentence you were considering. She smiles, easy and real, and something settles between you — not less than it could've been, just its own true shape.")),
      opt("Deflect with a joke. Too much, too fast.", { aloof: 2 },
        say("cody", "Careful, that almost sounded like a compliment."),
        n("Too fast, too light — and you watch the moment slide past both of you like it was never going to land anywhere.",
          "She laughs, but it's the polite kind. The railing suddenly feels very interesting to look at."))
    ),
    route(s => resolveEnding1(s))
  );

  /* -------------------------------------------------- route: Falcon */
  L("p1_night_fal",
    set("p1route", "fal"),
    n("A hand catches your sleeve before you can keep walking. Falcon, for once, isn't grinning."),
    say("falcon", "Walk with me. And don't make it weird. I'm already making it weird."),
    bg("rooftop_night"), music("night"), weather(null),
    chapter("Festival Night", "The Roof"),
    n("He drops onto the roof's edge, legs dangling over the safe side of the railing, the festival glittering below."),
    iff(s => s.flags.wishWho === "falcon",
      [say("falcon", "You saw my wish. Don't deny it. You got the little 'oh no' face."),
       say("cody", "I didn't say anything."),
       say("falcon", "I *know*. That's what I'm saying. You didn't say anything. Who does that?")]),
    say("falcon", "So — graduation. Everyone's making plans. Joseph's going to be a whole *person*. Cementoss is going to be famous for being quiet. Uraraka's going to top the class out of pure spite.",
      "And I've got a lot of jokes and no plan. I'm... kind of scared, honestly. I never told anyone that. You're, like, the first."),
    n("It's the least Falcon thing he's ever said. It lands in the quiet between fireworks like something fragile."),
    menu(
      opt("Tell him he's your best friend. No jokes.", { fx: { fal: 3 }, set: { falconSincere: true } },
        say("cody", "You're my best friend. That doesn't expire at graduation. I'm not letting it."),
        n("For a long moment he doesn't say anything. Then he exhales, and laughs, and it comes out a little wet."),
        say("falcon", "...Okay. Okay. Good. That's — yeah. Don't tell anyone I got sentimental.")),
      opt("Match his energy: joke first, then say it's true.", { fx: { fal: 2 }, set: { falconSincere: true } },
        say("cody", "I'd say you'll be fine, but you're a licensed hazard. ...You'll be fine. Because I'm going to be annoying about it for years."),
        say("falcon", "That's the nicest threat anyone's ever made me.")),
      opt("Deflect with a joke and leave it there.", { aloof: 2 },
        say("cody", "You'll be fine. Probably. Statistically."),
        n("He laughs the way he always does, quick and bright. But something behind it closes up again, and the moment goes with it."))
    ),
    route(s => resolveEnding1(s))
  );

  /* -------------------------------------------------- route: friends */
  L("p1_night_fri",
    set("p1route", "fri"),
    n("You find them where you always find them: the rooftop, as if the festival's loud enough already and they came up to hear themselves think."),
    bg("rooftop_night"), music("night"), weather(null),
    chapter("Festival Night", "The Roof"),
    n("Joseph, Cementoss, Falcon and Uraraka, scattered across the roof in the easy way of people who aren't pretending anymore. A bag of takoyaki that's definitely gone cold is being passed around."),
    say("joseph", "Cody! Sit! We were just about to do something dramatic and unnecessary. A toast, or a speech, or a pact — Cementoss won't tell me which."),
    say("cementoss", "Whichever one doesn't involve Joseph standing on the railing."),
    say("joseph", "That was *one time*."),
    n("Everyone's looking at you. It's a good kind of pressure."),
    menu(
      opt("Give a toast.", { fx: { fri: 2 } },
        say("cody", "To a semester none of us planned. To a tree that rained on all of us. To whoever put that glue gun in Falcon's hands."),
        say("falcon", "Slander. It was *destiny*."),
        n("Five paper cups meet in the dark, tapping lightly, and nobody makes a joke about the sound.")),
      opt("Propose a pact: the rooftop, every Saturday, no matter where you all end up.", { fx: { fri: 2 }, set: { pact: true } },
        say("cody", "After graduation. After everything. Every Saturday. If we have to FaceTime from different continents, the rooftop is still ours."),
        say("joseph", "I'm in. I'm so in. I'm already crying. Don't look at me."),
        say("cementoss", "Agreed."),
        n("Four cups. One uraraka-shaped cup, held up a beat late, like she wasn't sure she'd been invited — and then absolutely sure.")),
      opt("Stay quiet. Just be here.", { fx: { fri: 1 } },
        n("You don't say anything. You sit down in the gap between Joseph and Falcon, and the conversation closes around you like water. It doesn't need a speech. You're here, and so is everyone else."))
    ),
    route(s => resolveEnding1(s))
  );

  /* -------------------------------------------------- route: alone */
  L("p1_night_alone",
    set("p1route", "alone"),
    n("You walk past the food stalls, past the games, past the lanterns on the tree. Somewhere, people are laughing. Somewhere, a wish is being hung on a branch.",
      "Nobody catches your sleeve. Nobody calls your name. It isn't cruelty — it's what happens when you spend a semester making yourself easy to miss."),
    bg("rooftop_night"), music("sorrow"),
    chapter("Festival Night", "The Roof"),
    n("You end up on the roof by yourself, watching the festival shrink to a smear of light and sound below."),
    menu(
      opt("Stay a while. Let it hurt.", { aloof: 1 },
        n("The railing is cold under your arms. The city goes on without noticing.")),
      opt("Take out your phone. Maybe it's not too late to text someone.", {},
        n("You type a message, delete it, type another. You send it. It's just two words. It's the most you've said all semester."))
    ),
    route(s => resolveEnding1(s))
  );

  /* ================================================================ ENDING LOGIC */
  function resolveEnding1(s) {
    const { ura, fri, fal } = s.stats;
    const f = s.flags;
    if (f.p1route === "alone" || (s.aloof >= 4 && ura < 4 && fri < 4 && fal < 4)) return "ending_lonely";
    if (f.confessed && ura >= 8 && fri >= 6 && fal >= 3) return "ending_true";
    if (f.confessed && ura >= fri && ura >= fal) return "ending_romance";
    if (f.falconSincere && fal >= 6) return "ending_falcon";
    if (!f.confessed && fal >= ura && fal >= fri && fal >= 6 && f.p1route === "fal") return "ending_friends";
    return "ending_friends";
  }
  VN.resolveEnding1 = resolveEnding1;

  /* ================================================================ ENDINGS (Part I) */
  VN.ending("ending_romance", {
    part: 1, kind: "good", bg: "courtyard_sunset", music: "hope", weather: "petals",
    title: "Falling Petals", hint: "Tell Uraraka how you feel.",
    summary: "You told Uraraka the truth, and she stayed.",
    lines: [
      "Spring finishes the way it started: pink drifting past a tree that has, at this point, personally witnessed most of your worst and best decisions.",
      "Uraraka's hand finds yours somewhere between the lantern stall and the front gate, and neither of you mentions it, because neither of you has to.",
      "You didn't plan on falling for the new transfer student under a cherry tree in your last year of school. You're not mad about how it turned out.",
    ],
  });
  VN.ending("ending_friends", {
    part: 1, kind: "good", bg: "rooftop_sunset", music: "hope", weather: null,
    title: "Golden Hour", hint: "Choose your friends, over and over.",
    summary: "A semester built on rooftops, snacks, and people who stay.",
    lines: [
      "Not every good story ends with a confession under fireworks. Some end on a rooftop with your favorite people, a bag of chips someone still won't share, and a view you'll remember longer than most of the year's homework.",
      "Joseph's already planning next semester's rooftop hangouts. Cementoss is, as ever, the only one not visibly excited about it, which somehow makes it funnier. Falcon is narrating the sunset. Nobody stops him.",
      "You leave school that year with fewer secrets and more people who'd notice if you disappeared. That's not nothing. That might be everything.",
    ],
  });
  VN.ending("ending_falcon", {
    part: 1, kind: "good", bg: "courtyard_sunset", music: "hope", weather: "petals",
    title: "Tailwind", hint: "Be honest with Falcon when it counts.",
    summary: "You and Falcon: best friends, for real, for good.",
    lines: [
      "It isn't a love story — it's the other kind, the kind that doesn't get written about enough. Falcon's become the person you text first, the one who makes ordinary days feel like they're worth narrating.",
      "\"Don't get sentimental on me,\" he says, catching you looking. \"We've got a whole summer of bad ideas to get through first.\"",
      "You're already looking forward to every one of them.",
    ],
  });
  VN.ending("ending_true", {
    part: 1, kind: "true", bg: "courtyard_night", music: "hope", weather: "petals",
    title: "Our Spring Hours", hint: "Show up for everyone — and tell Uraraka the truth.",
    summary: "You didn't have to choose. You built it that way.",
    lines: [
      "This is the version where you didn't have to choose — where showing up for Joseph and Cementoss and Falcon all year made room for Uraraka too, instead of costing you the rest.",
      "Under the festival lanterns, with everyone who matters within shouting distance, Uraraka laces her fingers through yours and nobody acts surprised, because of course this is how it turned out. You built it that way, one ordinary afternoon at a time.",
      "Some semesters change everything. This was one of them, and you were there for every part of it, on purpose.",
    ],
  });
  VN.ending("ending_lonely", {
    part: 1, kind: "bad", bg: "hallway", music: "sorrow", weather: "dust",
    title: "Static", hint: "Keep everyone at arm's length.",
    summary: "Nothing went wrong, exactly. You just never showed up.",
    lines: [
      "The semester ends the way it started: quiet hallway, half a granola bar, nobody in particular waiting by your locker.",
      "It's not a tragedy. Nothing went wrong, exactly — you just never quite showed up for the moments that were asking for you, and moments stop asking after a while.",
      "Somewhere down the hall, Joseph's laugh carries over a conversation you're not part of. You tell yourself there's always next year. You're not sure you believe it.",
    ],
  });
})();
