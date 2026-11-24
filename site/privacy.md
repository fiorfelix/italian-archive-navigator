---
title: "Privacy · Italian Archive Navigator"
description: "Privacy policy of the Italian Archive Navigator connector for Claude: no accounts, request contents not stored, logs without addresses."
url: https://archives.fiorfelix.com/privacy
language: en
updated: 2026-11-24
---

# Privacy policy

Last updated: 24 November 2026

This policy covers the Italian Archive Navigator MCP server at `https://archives-mcp.fiorfelix.com/mcp`, the Claude plugin that connects to it, and these information pages. The service is run by fiorfelix.

## What the service is

A read-only service that answers questions about Italian places, records and archives, and drafts letters that you send yourself. It does not send e-mail, submit forms or contact any office on your behalf.

## Accounts

There are no accounts, logins or authentication. The service does not ask who you are.

## What you send, and what happens to it

When you use the connector, Claude sends the server the details a tool needs: place names, years and event types and, if you ask for a letter, the names, dates and contact details to be written into it.

- This information is used only to produce the answer to that request.
- It is **not stored**: not in a database, not in files, not in logs.
- It is not sold or shared, and the server sends it nowhere: it makes no outgoing requests while answering and reads only its own copy of public data.

## Logs

For each request the server logs only: the tool name, how long it took, whether it succeeded, and an error code if it failed. Logs never contain the content of a request or an answer, and never contain network addresses.

- **Network addresses:** the server sees the network address of each request only to apply rate limits, keeps it in memory for at most one minute, and never writes it down.
- **Retention:** logs are kept for at most 30 days. The current host keeps them for 7 days.

## Who else handles the traffic

- **Hosting:** the server runs on Render (render.com), whose network uses Cloudflare. They carry the requests to the server and may keep their own technical records under their own policies ([Render privacy policy](https://render.com/privacy)). We use such records only to diagnose problems.
- **Domain and information pages:** the domain's DNS and these pages are served by Cloudflare, which applies security rules (such as rate limits) to incoming requests and processes IP addresses for that purpose under the [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/).
- **Claude:** your conversations with Claude, including what you ask it to look up, are handled by Anthropic under [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy). This service receives only the tool calls Claude makes to it.

## The Claude plugin

The plugin's skills run inside your own Claude app and are text instructions only. What they work with stays with you:

- Register pages, transcriptions, the list of people and other notes are kept in your own archive folder (Claude Code or Cowork) or in your chat, never sent to this project.
- When you ask Claude Code or Cowork to download register pages, requests go only to the archive sites you choose, one page at a time, with a User-Agent naming the plugin and this site's contact page. No personal data is sent with them.
- If you ask for a presentation in Google Slides and have your own Google Drive or Google Slides connector in Claude, the presentation and the images you chose are saved in your own Google Drive through that connector, under Google's terms. Nothing goes to Google otherwise.
- The only service the plugin contacts on its own is the connector described above.

## These information pages

These pages use no cookies and no tracking. They use Cloudflare Web Analytics, which counts page views without cookies or other stored identifiers: which page was viewed, the referring site, the country, the type of browser and device, and page load times. It does not build profiles of visitors. The connector itself has no analytics script.

## Data the service publishes

Answers come from public open data (ISTAT and IndicePA, CC BY 4.0), from official archival guides and laws cited in each answer, and from this project's own curated files. Office contacts are those the offices publish themselves; names of office holders are not included, and only office mailboxes are kept.

## Living people

The service does not look up living people. Questions about events less than 100 years ago, or about people born after 1940, are directed to the Comune, which decides what it can release.

## The contact form

If you use the [contact form](https://archives.fiorfelix.com/contact), your message, the topic you choose and, if you give it, your e-mail address are sent by e-mail to the person who runs this project. They are not stored on any server or written to any log. Messages are kept in that mailbox only as long as needed to reply, and are never published or shared without your permission. Cloudflare Turnstile checks that the form is sent by a person, not a bot; it processes information about your browser and connection for that purpose under the [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/).

## Changes and contact

Changes to this policy are published on this page with a new date. For privacy questions, use the [contact form](https://archives.fiorfelix.com/contact).
