/* Article content for the news pages. Add a new object to publish a new article. */
window.ARTICLES=[
 {
  "id": "phones-in-your-drawer",
  "cat": "E-WASTE",
  "tag": "Recycling",
  "date": "2026-09-14",
  "read": 4,
    "img": "../assets/news-phones.svg",
  "title": "Why the phones in your drawer matter",
  "lead": "The average household keeps two or three unused phones. Together they hold metals worth recovering and chemicals worth keeping out of the ground.",
  "body": "<h2>A drawer full of value</h2><p>A single smartphone contains small amounts of gold, copper, cobalt and lithium. One phone is not much, but thousands of them add up to a resource that Jordan currently imports and then throws away.</p><p>Most people keep old phones \"just in case\". Within a year or two the battery degrades, the model becomes outdated and the device loses most of its resale value. The best time to pass a phone on is early.</p><blockquote>A working phone reused avoids far more carbon than the same phone recycled.</blockquote><h2>Reuse first, recycle second</h2><p>If a phone still turns on, it can usually be resold. That keeps the whole device in use, including the parts that are hard to recover, and saves the emissions of manufacturing a new one. Recycling is the right choice when a device is broken or too old to sell.</p><h2>What to do before you hand it in</h2><ul><li>Back up photos and contacts.</li><li>Sign out of Apple ID or Google and run a factory reset.</li><li>Remove the SIM and memory card.</li><li>Scan the device in the CircuTech app to see its value.</li></ul><p>Then either list it on the marketplace or drop it at a collection point and collect your reward points.</p>"
 },
 {
  "id": "collection-points-daily-life",
  "cat": "COMMUNITY",
  "tag": "Sustainability",
  "date": "2026-08-28",
  "read": 3,
    "img": "../assets/news-collection.svg",
  "title": "Making collection points part of daily life",
  "lead": "People recycle when it is easy. The closer a drop-off point is to where they already go, the more devices come back.",
  "body": "<h2>Convenience decides</h2><p>Surveys on household recycling keep finding the same thing: people are willing, but they do not know where to go. A collection point that is a long drive away competes with the bin that is five steps from the kitchen, and the bin wins.</p><h2>Where points work best</h2><ul><li>Next to supermarkets and malls people already visit weekly.</li><li>In universities and schools, where drives create habits early.</li><li>In offices, where old equipment piles up in storage rooms.</li></ul><blockquote>Recycling becomes a habit when it fits into a route you already take.</blockquote><h2>Make it rewarding</h2><p>Points and vouchers turn a chore into a small win. In the CircuTech app, each saved scan earns green points based on the device value and the carbon avoided, and the Drop-off tab shows which points are open right now.</p><p>We are adding more partner locations across Amman, Irbid and Aqaba, with the goal of a collection point within a short drive of every major city.</p>"
 },
 {
  "id": "inside-a-circuit-board",
  "cat": "TECHNOLOGY",
  "tag": "Electronics",
  "date": "2026-08-03",
  "read": 5,
    "img": "../assets/news-circuit.svg",
  "title": "What is inside a circuit board?",
  "lead": "A circuit board looks like plastic and metal lines, but it is one of the richest materials in any device.",
  "body": "<h2>Layers of material</h2><p>A printed circuit board is built from a glass-fibre and resin base, thin copper tracks, a protective coating and soldered components. The components add small amounts of gold, silver, palladium and tin.</p><h2>Why gold is there</h2><p>Gold does not corrode, so it is used on connectors and contact points where a reliable signal matters. Recycled electronics can contain more gold per ton than many natural ores.</p><blockquote>Recovering metals from old boards uses far less energy than mining new ones.</blockquote><h2>Why it needs a professional</h2><ul><li>Boards can contain lead and brominated flame retardants.</li><li>Burning them to extract metal releases toxic fumes.</li><li>Certified recyclers separate each material safely and sell it back to manufacturers.</li></ul><p>That is why broken devices should go to a collection point rather than an informal scrapyard.</p>"
 },
 {
  "id": "esg-reporting-basics",
  "cat": "BUSINESS",
  "tag": "ESG",
  "date": "2026-07-19",
  "read": 6,
    "img": "../assets/news-esg.svg",
  "title": "ESG reporting basics for e-waste",
  "lead": "Investors and customers increasingly ask what happens to a company's old equipment. Here is how to answer with evidence.",
  "body": "<h2>What to measure</h2><p>For electronic equipment, a useful ESG report covers four numbers: how many devices were retired, how many were reused or recycled, the carbon avoided, and where the material went.</p><h2>A simple process</h2><ul><li>Keep an inventory of devices when they are retired.</li><li>Choose reuse or certified recycling instead of disposal.</li><li>Record the hand-over with a certificate.</li><li>Report the totals each quarter.</li></ul><blockquote>If it was not recorded, it cannot be reported.</blockquote><h2>How CircuTech helps</h2><p>The Business programme gives your team a branded trade-in flow, a dashboard of devices and carbon savings, and a CSV export that can go straight into your sustainability report. Get in touch for a demo.</p>"
 }
];

(function () {
    'use strict';

    var storageKey = 'circutech_articles';
    var fallbackArticles = Array.isArray(window.ARTICLES) ? window.ARTICLES : [];
    var savedArticles = null;
    try {
        savedArticles = JSON.parse(localStorage.getItem(storageKey));
    } catch (error) {
        savedArticles = null;
    }
    window.ARTICLES = Array.isArray(savedArticles) ? savedArticles : fallbackArticles;
    window.CircuTechNews = {
        list: function () { return Array.isArray(window.ARTICLES) ? window.ARTICLES : []; },
        save: function (next) {
            if (!Array.isArray(next)) return false;
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
                window.ARTICLES = next;
                return true;
            } catch (error) {
                return false;
            }
        }
    };
    var articles = window.CircuTechNews.list().filter(function (article) { return article.status !== 'draft'; })
        .sort(function (left, right) { return String(right.date).localeCompare(String(left.date)); });
    function formatDate(value) {
        var date = new Date(value + 'T00:00:00');
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    function bindImage(container, article) {
        var image = container && container.querySelector('img');
        if (!image) return;
        image.alt = article.title || '';
        if (!article.img) {
            image.hidden = true;
            container.classList.add('image-missing');
            return;
        }
        image.loading = 'eager';
        image.addEventListener('error', function () {
            image.hidden = true;
            container.classList.add('image-missing');
        }, { once: true });
        image.src = article.img;
    }

    function makeCard(article, template) {
        var link = template.content.firstElementChild.cloneNode(true);
        link.dataset.articleId = article.id;
        link.href = 'article.html?id=' + encodeURIComponent(article.id);
        var category = link.querySelector('.jr-tag');
        var date = link.querySelector('time');
        var title = link.querySelector('h2, h3');
        var lead = link.querySelector('p');
        if (category) category.textContent = article.cat.toLowerCase().replace(/^./, function (letter) { return letter.toUpperCase(); });
        if (date) {
            date.dateTime = article.date;
            date.textContent = formatDate(article.date);
        }
        if (title) title.textContent = article.title;
        if (lead) lead.textContent = article.lead || '';
        bindImage(link.querySelector('.cv'), article);
        return link;
    }

    var featuredTarget = document.getElementById('newsFeatured');
    var listTarget = document.getElementById('newsList');
    if (featuredTarget && listTarget) {
        var featuredTemplate = document.getElementById('newsFeaturedTemplate');
        var rowTemplate = document.getElementById('newsRowTemplate');
        var emptyState = document.getElementById('newsEmpty');
        if (articles.length && featuredTemplate && rowTemplate) {
            featuredTarget.appendChild(makeCard(articles[0], featuredTemplate));
            articles.slice(1).forEach(function (article) { listTarget.appendChild(makeCard(article, rowTemplate)); });
            emptyState.hidden = true;
        } else if (emptyState) {
            emptyState.hidden = false;
        }
    }

    function recordArticleRead(articleId) {
        var session = null;
        var accounts = [];
        try {
            session = JSON.parse(sessionStorage.getItem('circutech_session'));
            accounts = JSON.parse(localStorage.getItem('circutech_users')) || [];
        } catch (error) {
            return;
        }
        if (!session || !session.email || !Number.isFinite(Number(session.exp)) || Number(session.exp) <= Date.now()) return;
        if (!Array.isArray(accounts) || !accounts.some(function (account) { return account.email === session.email && !account.suspended; })) return;
        var key = 'circutech_article_reads:' + session.email;
        var reads = [];
        try { reads = JSON.parse(localStorage.getItem(key)) || []; } catch (error) { reads = []; }
        if (!Array.isArray(reads)) reads = [];
        var now = Date.now();
        var existing = reads.find(function (entry) { return entry.id === articleId; });
        if (existing) existing.lastRead = now;
        else reads.push({ id: articleId, firstRead: now, lastRead: now });
        try { localStorage.setItem(key, JSON.stringify(reads)); } catch (error) {}
    }

    var articleTitle = document.getElementById('aTitle');
    if (!articleTitle) return;

    var id = new URLSearchParams(location.search).get('id');
    var index = articles.findIndex(function (article) { return article.id === id; });
    var article = articles[index];
    var layout = document.getElementById('layout');
    var cover = document.getElementById('aCover');
    var empty = document.getElementById('aEmpty');

    if (!article) {
        layout.hidden = true;
        cover.hidden = true;
        empty.hidden = false;
        articleTitle.textContent = 'Article not found';
        return;
    }

    recordArticleRead(article.id);
    document.title = article.title + ' | CircuTech Jo';
    document.getElementById('aCat').textContent = article.cat.toLowerCase().replace(/^./, function (letter) { return letter.toUpperCase(); });
    document.getElementById('aMeta').textContent = '· ' + formatDate(article.date) + ' · ' + article.read + ' min read';
    articleTitle.textContent = article.title;
    document.getElementById('aLead').textContent = article.lead || '';
    document.getElementById('aBody').innerHTML = article.body || '';
    bindImage(cover, article);

    var related = document.getElementById('aRel');
    articles.forEach(function (other) {
        if (other.id === article.id) return;
        var link = document.createElement('a');
        link.href = 'article.html?id=' + encodeURIComponent(other.id);
        link.textContent = other.title;
        var meta = document.createElement('small');
        meta.textContent = other.cat + ' · ' + other.read + ' min read';
        link.appendChild(meta);
        related.appendChild(link);
    });

    var navigation = document.getElementById('aNav');
    [[index + 1, '← Older'], [index - 1, 'Newer →']].forEach(function (item) {
        var other = articles[item[0]];
        if (!other) {
            navigation.appendChild(document.createElement('span'));
            return;
        }
        var link = document.createElement('a');
        link.className = 'btn soft sm';
        link.href = 'article.html?id=' + encodeURIComponent(other.id);
        link.textContent = item[1];
        navigation.appendChild(link);
    });

    document.getElementById('mailBtn').href = 'mailto:?subject=' + encodeURIComponent(article.title) + '&body=' + encodeURIComponent(location.href);
    document.getElementById('copyBtn').addEventListener('click', function () {
        var button = this;
        (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject())
            .then(function () { button.textContent = 'Link copied'; }, function () { button.textContent = 'Copy failed'; });
        setTimeout(function () { button.textContent = 'Copy link'; }, 2000);
    });
})();
