## Classes

<dl>
<dt><a href="#CachePolicyWrapper">CachePolicyWrapper</a></dt>
<dd><p>Wrapper for CachePolicy, supporting Request and Response argument types
as specified by the Fetch API.</p>
</dd>
<dt><a href="#ResponseWrapper">ResponseWrapper</a></dt>
<dd><p>Wrapper for the Fetch API Response class, providing support for buffering
the body stream and thus allowing repeated reads of the body.</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#fetch">fetch</a></dt>
<dd><p>Fetches a resource from the network or from the cache if the cached response
can be reused according to HTTP RFC 7234 rules. Returns a Promise which resolves once
the Response is available.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#cacheResponse">cacheResponse(request, response)</a> ⇒ <code>Response</code></dt>
<dd><p>Cache the response as appropriate. The body stream of the
response is consumed &amp; buffered to allow repeated reads.</p>
</dd>
<dt><a href="#onPush">onPush(fn)</a></dt>
<dd><p>Register a callback which gets called once a server Push has been received.</p>
</dd>
<dt><a href="#offPush">offPush(fn)</a></dt>
<dd><p>Deregister a callback previously registered with {#onPush}.</p>
</dd>
<dt><a href="#clearCache">clearCache()</a></dt>
<dd><p>Clears the cache i.e. removes all entries.</p>
</dd>
<dt><a href="#disconnectAll">disconnectAll()</a></dt>
<dd><p>Disconnect all open/pending sessions.</p>
</dd>
<dt><a href="#headersAsObject">headersAsObject(headers)</a> ⇒ <code>Object</code></dt>
<dd></dd>
<dt><a href="#convertRequest">convertRequest(req)</a> ⇒ <code>Object</code></dt>
<dd></dd>
<dt><a href="#convertResponse">convertResponse(res)</a> ⇒ <code>Object</code></dt>
<dd></dd>
<dt><a href="#toArrayBuffer">toArrayBuffer(buf)</a> ⇒ <code>ArrayBuffer</code></dt>
<dd><p>Convert a NodeJS Buffer to an ArrayBuffer</p>
</dd>
</dl>

<a name="CachePolicyWrapper"></a>

## CachePolicyWrapper
Wrapper for CachePolicy, supporting Request and Response argument types
as specified by the Fetch API.

**Kind**: global class  
**See**: https://github.com/kornelski/http-cache-semantics#constructor-options  

* [CachePolicyWrapper](#CachePolicyWrapper)
    * [new CachePolicyWrapper(req, res, options)](#new_CachePolicyWrapper_new)
    * [.storable()](#CachePolicyWrapper+storable)
    * [.satisfiesWithoutRevalidation(req)](#CachePolicyWrapper+satisfiesWithoutRevalidation) ⇒
    * [.responseHeaders(res)](#CachePolicyWrapper+responseHeaders) ⇒ <code>Headers</code>
    * [.timeToLive()](#CachePolicyWrapper+timeToLive)

<a name="new_CachePolicyWrapper_new"></a>

### new CachePolicyWrapper(req, res, options)
Creates a new CachePolicyWrapper instance.


| Param | Type |
| --- | --- |
| req | <code>Request</code> | 
| res | <code>Response</code> | 
| options | <code>Object</code> | 

<a name="CachePolicyWrapper+storable"></a>

### cachePolicyWrapper.storable()
**Kind**: instance method of [<code>CachePolicyWrapper</code>](#CachePolicyWrapper)  
**See**: https://github.com/kornelski/http-cache-semantics#storable  
<a name="CachePolicyWrapper+satisfiesWithoutRevalidation"></a>

### cachePolicyWrapper.satisfiesWithoutRevalidation(req) ⇒
**Kind**: instance method of [<code>CachePolicyWrapper</code>](#CachePolicyWrapper)  
**Returns**: boolean  
**See**: https://github.com/kornelski/http-cache-semantics#satisfieswithoutrevalidationnewrequest  

| Param | Type |
| --- | --- |
| req | <code>Request</code> | 

<a name="CachePolicyWrapper+responseHeaders"></a>

### cachePolicyWrapper.responseHeaders(res) ⇒ <code>Headers</code>
**Kind**: instance method of [<code>CachePolicyWrapper</code>](#CachePolicyWrapper)  
**See**: https://github.com/kornelski/http-cache-semantics#responseheaders  

| Param | Type |
| --- | --- |
| res | <code>Response</code> | 

<a name="CachePolicyWrapper+timeToLive"></a>

### cachePolicyWrapper.timeToLive()
**Kind**: instance method of [<code>CachePolicyWrapper</code>](#CachePolicyWrapper)  
**See**: https://github.com/kornelski/http-cache-semantics#timetolive  
<a name="ResponseWrapper"></a>

## ResponseWrapper
Wrapper for the Fetch API Response class, providing support for buffering
the body stream and thus allowing repeated reads of the body.

**Kind**: global class  
**See**: https://developer.mozilla.org/en-US/docs/Web/API/Response  
<a name="new_ResponseWrapper_new"></a>

### new ResponseWrapper(res)

| Param | Type |
| --- | --- |
| res | <code>Response</code> | 

<a name="fetch"></a>

## fetch
Fetches a resource from the network or from the cache if the cached response
can be reused according to HTTP RFC 7234 rules. Returns a Promise which resolves once
the Response is available.

**Kind**: global variable  
**See**

- https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
- https://httpwg.org/specs/rfc7234.html

<a name="cacheResponse"></a>

## cacheResponse(request, response) ⇒ <code>Response</code>
Cache the response as appropriate. The body stream of the
response is consumed & buffered to allow repeated reads.

**Kind**: global function  
**Returns**: <code>Response</code> - cached response with buffered body or original response if uncached.  

| Param | Type |
| --- | --- |
| request | <code>Request</code> | 
| response | <code>Response</code> | 

<a name="onPush"></a>

## onPush(fn)
Register a callback which gets called once a server Push has been received.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | callback function invoked with the url of the pushed resource |

<a name="offPush"></a>

## offPush(fn)
Deregister a callback previously registered with {#onPush}.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | callback function registered with {#onPush} |

<a name="clearCache"></a>

## clearCache()
Clears the cache i.e. removes all entries.

**Kind**: global function  
<a name="disconnectAll"></a>

## disconnectAll()
Disconnect all open/pending sessions.

**Kind**: global function  
<a name="headersAsObject"></a>

## headersAsObject(headers) ⇒ <code>Object</code>
**Kind**: global function  

| Param | Type |
| --- | --- |
| headers | <code>Headers</code> | 

<a name="convertRequest"></a>

## convertRequest(req) ⇒ <code>Object</code>
**Kind**: global function  

| Param | Type |
| --- | --- |
| req | <code>Request</code> | 

<a name="convertResponse"></a>

## convertResponse(res) ⇒ <code>Object</code>
**Kind**: global function  

| Param | Type |
| --- | --- |
| res | <code>Response</code> | 

<a name="toArrayBuffer"></a>

## toArrayBuffer(buf) ⇒ <code>ArrayBuffer</code>
Convert a NodeJS Buffer to an ArrayBuffer

**Kind**: global function  
**See**: https://stackoverflow.com/a/31394257  

| Param | Type |
| --- | --- |
| buf | <code>Buffer</code> | 

