// ==UserScript==
// @name         Spotify Playlist Extractor
// @namespace    http://tampermonkey.net/
// @version      2025-05-22
// @description  Extracts song titles, artists, albums and durations from a Spotify playlist
// @author       Elias Braun
// @match        https://*.spotify.com/playlist/*
// @icon         https://raw.githubusercontent.com/eliasbraunv/SpotifyExtractor/refs/heads/main/spotifyexcel6464.png
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(async function () {
    'use strict';

    function sanitize(text) {
        return text
            ? text.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim()
            : '';
    }

    function waitForScrollContainer(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                const el = document.querySelector('[data-overlayscrollbars-viewport*="overflowYScroll"]');
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject('Scroll container not found in time');
                }
            }, 300);
        });
    }

    function extractVisibleSongs() {
        const rows = document.querySelectorAll('div[data-testid="tracklist-row"]');
        const songs = new Map();

        rows.forEach(row => {
            try {
                const titleLink = row.querySelector('div[aria-colindex="2"] a[data-testid="internal-track-link"] div.encore-text-body-medium');
                const title = sanitize(titleLink?.textContent);

                const artistAnchors = row.querySelectorAll('div[aria-colindex="2"] span.encore-text-body-small a');
                const artist = sanitize(Array.from(artistAnchors).map(a => a.textContent).join(', '));

                const albumLink = row.querySelector('div[aria-colindex="3"] a');
                const album = sanitize(albumLink?.textContent);

                const durationDiv = row.querySelector('div[aria-colindex="5"] div.encore-text-body-small');
                const duration = sanitize(durationDiv?.textContent);

                if (title && artist && album && duration) {
                    songs.set(
                        title + '||' + artist + '||' + album + '||' + duration,
                        { title, artist, album, duration }
                    );
                }
            } catch {
                // skip rows that don't fit pattern
            }
        });

        return Array.from(songs.values());
    }

    async function scrollAndExtractSongs(scrollContainer) {
        const collectedSongs = new Map();
        let previousScrollTop = -1;
        let sameCount = 0;

        while (sameCount < 5) {
            const visibleSongs = extractVisibleSongs();
            visibleSongs.forEach(({ title, artist, album, duration }) => {
                collectedSongs.set(title + '||' + artist + '||' + album + '||' + duration, { title, artist, album, duration });
            });

            scrollContainer.scrollTop += 500;
            await new Promise(r => setTimeout(r, 100));

            if (scrollContainer.scrollTop === previousScrollTop) {
                sameCount++;
            } else {
                sameCount = 0;
                previousScrollTop = scrollContainer.scrollTop;
            }
        }

        return Array.from(collectedSongs.values());
    }

    function formatSongsForClipboard(songs) {
        return songs.map(({ title, artist, album, duration }) =>
            `${title}\t${artist}\t${album}\t${duration}`
        ).join('\n');
    }

async function copyToClipboard(text, songCount) {
    try {
        await navigator.clipboard.writeText(text);
        alert(`${songCount} songs extracted`);
    } catch (e) {
        console.error('❌ Failed to copy playlist to clipboard:', e);
        alert('❌ Failed to copy playlist to clipboard. See console.');
    }
}

    // Function to run extraction + copy
async function extractAndCopy() {
    try {
        console.log('⏳ Waiting for scroll container...');
        const scrollContainer = await waitForScrollContainer();
        console.log('✅ Scroll container found. Scrolling and collecting songs, artists, albums, and durations...');

        const allSongs = await scrollAndExtractSongs(scrollContainer);

        console.log(`🎵 Done! Found ${allSongs.length} unique songs:`);
        console.table(allSongs);

        const formattedText = formatSongsForClipboard(allSongs);
        // Pass songs count to copyToClipboard
        await copyToClipboard(formattedText, allSongs.length);
    } catch (err) {
        console.error('❌ Error:', err);
        alert('❌ Error occurred during extraction. See console.');
    }
}

    // Inject the "Extract" button next to existing button
    function addExtractButton() {
        // Find the existing Spotify "more-button" to clone styles
        const existingButton = document.querySelector('button[data-testid="more-button"]');
        if (!existingButton) {
            console.warn('Could not find existing button to clone styles from.');
            return;
        }

        // Create the new button
        const extractButton = document.createElement('button');
        extractButton.className = existingButton.className; // clone classes
        extractButton.setAttribute('aria-label', 'Extract playlist data');
        extractButton.setAttribute('data-testid', 'extract-button');
        extractButton.setAttribute('type', 'button');
        extractButton.setAttribute('aria-haspopup', 'false');
        extractButton.setAttribute('aria-expanded', 'false');

        // Use a span with text instead of icon
        extractButton.innerHTML = `<span aria-hidden="true" class="e-9911-button__icon-wrapper" style="font-weight: 600; font-size: 1rem; line-height: 1; user-select:none;">Extract to Clipboard</span>`;

        // Insert it right after the existing button
        existingButton.parentNode.insertBefore(extractButton, existingButton.nextSibling);

        // Add click listener to run extraction
        extractButton.addEventListener('click', extractAndCopy);
    }

    // Run addExtractButton after a short delay so page elements are loaded
    setTimeout(addExtractButton, 2000);

})();
