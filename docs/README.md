# Referrer Control

First, you must understand the concept of a [Referer][].

[Referer]: https://wikipedia.org/wiki/HTTP_referer

## Term

Suppose there is an HTML page `http://www.example.com/index.html`, and it includes an image and a link, and it's source looks like:

    <!DOCTYPE html>
    <html>
    <head>
        <title>Just test</title>
    </head>
    <body>
        <img src="http://www.mozilla.org/firefox-logo.png"/>
        <a href="http://www.mozilla.org/">Link</a>
    </body>
    </html>

When you visit this page, Firefox will send an HTTP request to get the image, like this:

    GET /firefox-logo.png HTTP/1.1
    Host: www.mozilla.org
    Referer: http://www.example.com/index.html

When you click the link, it is similar:

    GET / HTTP/1.1
    Host: www.mozilla.org
    Referer: http://www.example.com/index.html

The `Referer` line tells the server which page referred the image and where you come from.

In extension terms, `http://www.example.com/index.html` is called the _source_. and `http://www.mozilla.org/firefox-logo.png` is called the _target_.

## Blank Source

What about if the source URL is blank? 

According to the web standard, in some situations, Firefox won't add Referer header the http request: 

* Type or paste the URL in location bar, then hit `Enter` to open it.
* Open the URL from bookmark/history.
* Open URL by another application.
* Source URL uses the "https://" protocol , but the target URL uses the "http://" protocol.

The request created by these situations call "blank source request" in extension terms.

Because there are no Referer header to be sent to the server, there are no privacy problems. If add a Referer, it may break the page. So by default, the extension ignore these type requests, and lets them go immediately.

But some people need the extension add Referer header in this type request. For example, a web developer is working with a referrer-protected web API URL; he is constructing the URL in his program, and is debugging the URL arguments in the location bar to review the response.

So, there is an option "Ignore blank source request" in the preferences. When it is unchecked, the extension will handle these type requests as well.

## Same Domains

There is an option "Ignore same domains request", that is "only handle third-party request" or "only handle cross-site request".

Same domains mean _source_ and _target_ domains are the same, but note the base domain and sub-domain situations.

**example 1:**

* source: `http://www.example.com/index.html`
* target: `http://www.example.com/test.html`

Yes, because the domain both are `www.example.com`.

**example 2:**

* source: `http://www.example.com/index.html`
* target: `http://www.mozilla.org/firefox-logo.png`

No, because base domain is not the same, one is `www.example.com`, another is `www.mozilla.org`.

**example 3:**

* source: `http://www.example.com/index.html`
* target: `http://www.example.com.hk/index.html`

No, because base domain is not the same, one is `example.com`, another is `example.com.hk`.

**example 4:**

* source: `http://cdn.example.com/index.html`
* target: `http://static.example.com/image.png`

Base domain is the same, but the subdomain part is not. So it depends on the option "Treat subdomains as different domains", aka _strict mode_. If the option is checked, the result is no, otherwise yes.

## Policy

Suppose in this case

* source: `http://www.example.com/index.html`
* target: `http://www.mozilla.org/firefox-logo.png`

Each policy means

* skip: No change, keep it as `http://www.example.com/index.html`.
* remove: Don't send the header.
* source host: Change to `http://www.example.com/`, because host is `www.example.com`.
* source domain: Change to `http://example.com/`, because the base domain is `example.com`.
* target host: Change to `http://www.mozilla.org/`, like _source host_.
* target domain: Change to `http://mozilla.org/`, like _source domain_.
* target url: Change to `http://www.mozilla.org/firefox-logo.png`.

Note that if the URL is an IP address like `http://127.0.0.1/index.html`, _source domain_ and _target domain_ are just like _source host_ and _target host_.

## Priority

Some sites functions may rely on the `Referer` string, so if you find any page broken, you can

* Just deactivate the button let the extension stop working.
* Switch the default policy, find if it work on another policy.
* Write a custom rule for that site.

Custom rules have a higher priority than the default policy. That is, if there is no matching custom rule, then the default policy will be applied.

## Rules

There is a GUI rule manager to edit custom rules. Changed to rules are applied immediately, even before closing the rule manager.  Each rule has the following fields:

* source
* target
* value
* comment

_source_ and _target_ are wildcard or regular expressions, both must **match the entire URL**. 

If either expression starts and ends with a forward slash `/`, then it is treated as a regular expression; otherwise it is treated as a wildcard.

Wildcards will be compiled into regular expressions, so there are no performance differences.

For example, `http://*.google.com/*` is equal to `/^http:\/\/.*.google.com\/.*$/`.

Any literal use of asterisks or question marks in wildcard expressions must be escaped with a backslash `\`.

Note, if you use the wildcard expression `http://*.google.com/*`, it just matches the subdomains of the URL, not including the base domain itself (*google.com*).  If you want to match the base domain, you must add another rule and set the appropriate expression to `http://google.com/*`.  Alternatively, you can use regular expression `/^https?:\/\/(?:[^/]+\.)*google\.com\/.*$/`; this will also match http and https protocols.
