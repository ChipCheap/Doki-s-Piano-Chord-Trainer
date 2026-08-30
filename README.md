# Doki' s Piano Chord Trainer
A PWA app to train reading chords and playing them! Download the repository files and open the index.html to start using it.
Note that opening the file directly (via `file://`) cannot register a service worker in any browser, so you get the app but no offline mode. For the full PWA behaviour, serve the folder over HTTP — for example `python -m http.server 8000` in the repository folder, then open http://localhost:8000. You can also run it on a mobile device, but this app is intended to be used with a piano that sends the MIDI output to whatever runs the app. Sound recognition is not supported, unfortunately.
The app has relatively little to do with Doki, but I just added it for flavor :) 
Hope you like her!

## How to use:
In the top right there is a settings menu with which you can enable/disable and weight the probability by which it will be randomized in a session.
Save the settings to be able to recover them via import or simply leave it in localStorage.

Reset all settings back to all enabled with each chord type having equal distribution.

Once that is set up, you can use the random button to give you weighted randomized chords.

Enter a practice session to automatically read input and advance to another random chord. All chords in a session will be stored as thumbnails below to review whether the right notes were played or not.

Disclaimer:
Most of the code was AI generated and only skimmed by me occasionally to adjust some functionality, but as it seemed pretty solid in what it is doing, I haven't spent too much time fully understanding all parts like the settings and rendering.
The music theory was more hand-written, as it was having trouble really discerning between notes, as MIDI doesn't differentiate between a C and a B# for example. Be aware that I am also not an expert in music theory, but I have checked with someone else that is.

Known issues:
The two engraving issues that used to be listed here are fixed — a cluster of seconds now alternates left/right/left instead of marching right, and a C next to a B is offset properly. If you spot something else, feel free to open a pull request and contact me.

Future implementations:
See ROADMAP.md — mainly chords within scales (so that not all the corresponding augments are shown next to the notes), other styling options, and a staff display closer to real piano grand staff sheets.
- If you have any suggestions feel free to adjust the app on a fork or apply a pull request or contact me! I am not sure if I am going to be working all too much on this again, only if I feel like something is lacking for my intents and purposes.
