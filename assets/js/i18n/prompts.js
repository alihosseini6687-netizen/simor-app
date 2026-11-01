/* Curated local prompt packs for new locales. Original 300/200 en/fa banks
 * remain intact. These smaller packs are not claimed as a complete migration. */
(()=>{'use strict';const languages=['ru','ar','hi','fr','de'];
 const truth=[
 ['Какое место вы хотели бы посетить?','أي مكان تتمنى زيارته؟','आप किस जगह जाना चाहते हैं?','Quel endroit aimeriez-vous visiter ?','Welchen Ort möchtest du besuchen?'],
 ['Какой навык вы хотели бы освоить?','ما المهارة التي ترغب في تعلمها؟','आप कौन सा हुनर सीखना चाहते हैं?','Quelle compétence aimeriez-vous apprendre ?','Welche Fähigkeit möchtest du lernen?'],
 ['Какая игра вам больше всего нравится?','ما لعبتك المفضلة؟','आपका पसंदीदा खेल कौन सा है?','Quel est votre jeu préféré ?','Was ist dein Lieblingsspiel?'],
 ['Какой небольшой поступок поднял вам настроение?','ما التصرف البسيط الذي أسعدك؟','किस छोटी बात से आपको खुशी मिली?','Quel petit geste vous a fait plaisir ?','Welche kleine Geste hat dich gefreut?'],
 ['Какое блюдо вы любите готовить?','ما الطبق الذي تحب تحضيره؟','आपको कौन सा खाना बनाना पसंद है?','Quel plat aimez-vous cuisiner ?','Welches Gericht kochst du gern?'],
 ['Чем вы гордитесь на этой неделе?','بماذا تفخر هذا الأسبوع؟','इस सप्ताह आपको किस बात पर गर्व है?','De quoi êtes-vous fier cette semaine ?','Worauf bist du diese Woche stolz?'],
 ['Какой фильм вы посоветовали бы друзьям?','ما الفيلم الذي تنصح به أصدقاءك؟','दोस्तों को कौन सी फ़िल्म सुझाएँगे?','Quel film conseilleriez-vous à vos amis ?','Welchen Film würdest du Freunden empfehlen?'],
 ['Как выглядит ваш идеальный выходной?','كيف يبدو يوم عطلتك المثالي؟','आपकी आदर्श छुट्टी कैसी होगी?','À quoi ressemble votre journée de repos idéale ?','Wie sieht dein idealer freier Tag aus?']
 ];
 const dare=[
 ['Изобразите робота десять секунд, если хотите.','قلّد روبوتًا لعشر ثوانٍ إن رغبت.','चाहें तो दस सेकंड रोबोट की नकल करें।','Imitez un robot pendant dix secondes, si vous le souhaitez.','Spiele zehn Sekunden lang einen Roboter, wenn du möchtest.'],
 ['Назовите три фрукта за пять секунд.','اذكر ثلاث فواكه خلال خمس ثوانٍ.','पाँच सेकंड में तीन फलों के नाम बताएँ।','Nommez trois fruits en cinq secondes.','Nenne in fünf Sekunden drei Früchte.'],
 ['Придумайте весёлое название команды.','ابتكر اسمًا مرحًا للفريق.','टीम का मज़ेदार नाम सोचें।','Inventez un nom d’équipe amusant.','Erfinde einen lustigen Teamnamen.'],
 ['Нарисуйте звезду в воздухе.','ارسم نجمة في الهواء.','हवा में तारा बनाएँ।','Dessinez une étoile dans les airs.','Zeichne einen Stern in die Luft.'],
 ['Скажите другу добрый комплимент.','قدّم لصديقك مجاملة لطيفة.','दोस्त की अच्छी बात कहें।','Faites un compliment bienveillant à un ami.','Mache einem Freund ein freundliches Kompliment.'],
 ['Придумайте короткое приветствие для инопланетян.','ابتكر تحية قصيرة لكائنات فضائية.','एलियनों के लिए छोटा अभिवादन बनाएँ।','Inventez une courte salutation extraterrestre.','Erfinde eine kurze Begrüßung für Außerirdische.'],
 ['Перечислите пять цветов.','اذكر خمسة ألوان.','पाँच रंगों के नाम बताएँ।','Citez cinq couleurs.','Nenne fünf Farben.'],
 ['Расскажите историю из одного предложения.','احكِ قصة من جملة واحدة.','एक वाक्य की कहानी सुनाएँ।','Racontez une histoire en une phrase.','Erzähle eine Geschichte in einem Satz.']
 ];
 window.SimabPromptLocales=Object.fromEntries(languages.map((lang,index)=>[lang,{truth:truth.map(row=>row[index]),dare:dare.map(row=>row[index])}]));
})();
