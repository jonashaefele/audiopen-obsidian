# AudioPen - Obsidian Webhooks

Obsidian plugin and service that connects your editor to [AudioPen](https://audiopen.ai/?aff=x0g97).

This is based on the amazing work [trashhalo](https://github.com/trashhalo) did with [obsidian-webhooks](https://github.com/trashhalo/obsidian-webhooks), but updated and extended to work with AudioPen.

## ToDo

- [x] test-deploy to firebase
- [x] change buffer to save audiopen payload
- [x] update plugin to create MD from audiopen JSON
- [x] update plugin to create/update (update if audiopenID matches title only for security purposes)
- [x] map tags to notes (link to notes)
- [x] add toggle audiopen tags to notes or tags
- [x] set folder in plugin settings
- [x] add template functionality
- [ ] update docs
- [ ] update landing page
- [ ] publish plugin
- [ ] submit plugin for release
- [ ] update wipe and buffer functionality on website

## Setting up the plugin

1. Install the obsidian plugin from releases
2. Go to https://audiopen-obsidian.web.app to signup for the service
3. Generate a login token and install it into the audiopen-obsidian plugin settings in Obsidian
4. Add the webhook url to AudioPen

- as an automatic webhook
- (optionally) as a manual trigger, if you want to be able to update notes

## Custom Templates

You can create custom templates for your notes by creating a `audiopen-template.md` file, preferably in your template folder with your other templates.

### 1. Choose a starting point for your template:

- [Template with AudioPen tags as Obsidian Links](plugin/templates/template-links.md?plain=1)
- [Template with AudioPen tags as Obsidian tags](plugin/templates/template-tags.md?plain=1)

### 2. Save it to your Vault's template folder

### 3. Edit it to your liking

You can use the following variables in your template:

- `{title}` - title of the AudioPen note
- `{body}` - rewritten version of the note
- `{orig_transcript}` - original transcript of the note
- `{id}` - AudioPenID - if you remove this from the template, it won't be able to append or update notes and will always create a new one.
- `{date_created}` - date created in AudioPen
- `{date_formatted}` - date created formatted to link to your daily notes, uses settings in periodic notes plugin, or daily notes plugin if periodic notes isn't installed.
- `{tagsAsLinks}` - AudioPen tags formatted as list of `[[Links]]` for Obsidian properties
- `{tagsAsTags}` - AudioPen tags formatted as a list of tags for Obsidian properties

> **Note:**
> Both `{tagsAsLinks}` and `{tagsAsTags}` are rendered as a simple list like:
>
> ```
>   - "[[Link one]]"
>   - "[[Link two]]"
> ```
>
> They currently don't handle empty states for you, that's why I suggest always having one tag or one link in the templte before you insert `{tagsAsLinks}` or `{tagsAsTags}`. As you can see in the example templates, I added a tag `#audio-pen` and a link to the current daily note using `{date_formatted}`.

### 4. Add the template to the plugin settings

- toggle `Use custom template` on and select your template in the dropdown below.

### 5. Test it

- make a new note on [AudioPen](https://audiopen.ai/?aff=x0g97) to make sure the template works for you.

## Suport this plugin

If you sign up to [AudioPen](https://audiopen.ai/?aff=x0g97) with a link from this readme, I'll get a little kickback at no cost to you. You can also:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/R5R7K2D7N) or become a [Github Sponsor](https://github.com/sponsors/jonashaefele)

And while you're at it, you might be interested in some of the other things I think about and create.
You can find my work [slow.works](https://slow.works) oand read about my thoughts on [Substack](https://slowworks.substack.com/)

```

```
