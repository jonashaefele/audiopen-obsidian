# AudioPen - Obsidian Webhooks

Obsidian plugin and service that connects your editor to audiopen.
This is based on the amazing work [trashhalo](https://github.com/trashhalo) did with [obsidian-webhooks](https://github.com/trashhalo/obsidian-webhooks), but updated and extended to work with AudioPen.

## ToDo

- [x] test-deploy to firebase
- [x] change buffer to save audiopen payload
- [x] update plugin to create MD from audiopen JSON
- [x] update plugin to create/update (update if audiopenID matches title only for security purposes)
- [x] map tags to notes (link to notes)
- [x] add toggle audiopen tags to notes or tags
- [x] set folder in plugin settings
- [?] add folder support
- [x] add template functionality
- [ ] update docs
- [ ] update landing page
- [ ] publish plugin
- [ ] submit plugin for release
- [ ] update wipe and buffer functionality on website

## Example Use cases

- add quick thoughts to your notes by talking to your Google assistant
- capture a note every time you like a song on Spotify
- capture a note every time you react to a slack message with a pencil emoji
- change or add notes any time you do any action on any other app

## Setting up the plugin

1. Install the obsidian plugin from releases
2. Go to https://audiopen-obsidian.web.app to signup for the service
3. Generate a login token and install it into the audiopen-obsidian plugin settings in Obsidian
4. Add the webhook url to AudioPen

- as an automatic webhook
- (optionally) as a manual trigger, if you want to be able to update notes

## Suport this plugin

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/R5R7K2D7N)

or become a Github Sponsor:

<iframe src="https://github.com/sponsors/jonashaefele/button" title="Sponsor jonashaefele" height="32" width="114" style="border: 0; border-radius: 6px;"></iframe>

And while your at it, you might be interested in some of the other things I think about and create.
You can find my work [slow.works](https://slow.works) oand read about my thoughts on [Substack](https://slowworks.substack.com/)
