# Doki-s-Piano-Chord-Trainer
A PWA app to train reading chords and playing them! Download the repository files and open the index.html to start using it. You can also run it on a mobile device, but this app is intended to be used with a piano that sends the MIDI output to whatever runs the app. Sound recognition is not supported, unfortunately.

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
Sometimes the display is a bit wonky, but I think it was alright for what it's supposed to do. Like three notes separated by a second will go to the right twice instead of going left right left. 
Middle C doesn't shift to the right like it should when B is present. Stuff like that I haven't gotten to fix yet, but if you want to fix it, feel free to open a pull request and contact me.

Future implementations:
- Other styling options
- different Staff display to be closer to real piano grand staff sheets.
- chords within scales, so that the not all the corresponding augments are shown next to the notes.
- If you have any suggestions feel free to adjust the app on a fork or apply a pull request or contact me! I am not sure if I am going to be working all too much on this again, only if I feel like something is lacking for my intents and purposes.
