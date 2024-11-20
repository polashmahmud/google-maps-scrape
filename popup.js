document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var currentTab = tabs[0];
        var actionButton = document.getElementById('actionButton');
        var downloadCsvButton = document.getElementById('downloadCsvButton');
        var resultsTable = document.getElementById('resultsTable');
        var filenameInput = document.getElementById('filenameInput');

        if (currentTab && currentTab.url.includes("://www.google.com/maps/search")) {
            document.getElementById('message').textContent = "Let's scrape Google Maps!";
            actionButton.disabled = false;
            actionButton.classList.add('enabled');
        } else {
            var messageElement = document.getElementById('message');
            messageElement.innerHTML = '';
            var linkElement = document.createElement('a');
            linkElement.href = 'https://www.google.com/maps/search/';
            linkElement.textContent = "Go to Google Maps Search.";
            linkElement.target = '_blank';
            messageElement.appendChild(linkElement);

            actionButton.style.display = 'none';
            downloadCsvButton.style.display = 'none';
            filenameInput.style.display = 'none';
        }

        actionButton.addEventListener('click', function() {
            chrome.scripting.executeScript({
                target: {tabId: currentTab.id},
                function: scrapeData
            }, function(results) {
                updateResultsTable(resultsTable, results);
                if (results && results[0] && results[0].result && results[0].result.length > 0) {
                    downloadCsvButton.disabled = false;
                }
            });
        });

        downloadCsvButton.addEventListener('click', function() {
            var csv = tableToCsv(resultsTable);
            var filename = filenameInput.value.trim() || 'google-maps-data.csv';
            filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.csv';
            downloadCsv(csv, filename);
        });
    });
});

function scrapeData() {
    var links = Array.from(document.querySelectorAll('a[href^="https://www.google.com/maps/place"]'));
    return links.map(link => {
        var container = link.closest('[jsaction*="mouseover:pane"]');
        var titleText = container ? container.querySelector('.fontHeadlineSmall').textContent : '';
        var rating = '', reviewCount = '', phone = '', industry = '', address = '', companyUrl = '', email = '';

        if (container) {
            var roleImgContainer = container.querySelector('[role="img"]');
            if (roleImgContainer) {
                var ariaLabel = roleImgContainer.getAttribute('aria-label');
                if (ariaLabel && ariaLabel.includes("stars")) {
                    var parts = ariaLabel.split(' ');
                    rating = parts[0];
                    reviewCount = '(' + parts[2] + ')';
                }
            }

            var containerText = container.textContent || '';
            var addressMatch = containerText.match(/\d+ [\w\s]+(?:#\s*\d+|Suite\s*\d+|Apt\s*\d+)?/);
            if (addressMatch) {
                address = addressMatch[0];
                var textBeforeAddress = containerText.substring(0, containerText.indexOf(address)).trim();
                var ratingIndex = textBeforeAddress.lastIndexOf(rating + reviewCount);
                if (ratingIndex !== -1) {
                    var rawIndustryText = textBeforeAddress.substring(ratingIndex + (rating + reviewCount).length).trim().split(/[\r\n]+/)[0];
                    industry = rawIndustryText.replace(/[·.,#!?]/g, '').trim();
                }
                address = address.replace(/\b(Closed|Open 24 hours|24 hours)|Open\b/g, '').trim();
            }

            var allLinks = Array.from(container.querySelectorAll('a[href]'));
            var filteredLinks = allLinks.filter(a => !a.href.startsWith("https://www.google.com/maps/place/"));
            if (filteredLinks.length > 0) {
                companyUrl = filteredLinks[0].href;
            }

            var phoneMatch = containerText.match(/(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
            phone = phoneMatch ? phoneMatch[0] : '';

            var emailMatch = containerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            email = emailMatch ? emailMatch[0] : '';
        }

        return { title: titleText, rating, reviewCount, phone, industry, address, companyUrl, email, href: link.href };
    });
}

function updateResultsTable(table, results) {
    while (table.firstChild) {
        table.removeChild(table.firstChild);
    }

    const headers = ['Title', 'Rating', 'Reviews', 'Phone', 'Industry', 'Address', 'Website', 'Email', 'Google Maps Link'];
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
        const header = document.createElement('th');
        header.textContent = headerText;
        headerRow.appendChild(header);
    });
    table.appendChild(headerRow);

    if (!results || !results[0] || !results[0].result) return;
    results[0].result.forEach(item => {
        var row = document.createElement('tr');
        ['title', 'rating', 'reviewCount', 'phone', 'industry', 'address', 'companyUrl', 'email', 'href'].forEach(key => {
            var cell = document.createElement('td');
            if (key === 'reviewCount' && item[key]) {
                item[key] = item[key].replace(/\(|\)/g, '');
            }
            cell.textContent = item[key] || '';
            row.appendChild(cell);
        });
        table.appendChild(row);
    });
}

function tableToCsv(table) {
    var csv = [];
    var rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        var cols = row.querySelectorAll('td, th');
        var rowData = Array.from(cols).map(col => `"${col.innerText}"`);
        csv.push(rowData.join(','));
    });
    return csv.join('\n');
}

function downloadCsv(csv, filename) {
    var csvFile = new Blob([csv], {type: 'text/csv'});
    var downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
}