## [3.0.4](https://github.com/adobe/helix-fetch/compare/v3.0.3...v3.0.4) (2022-02-14)


### Bug Fixes

* **deps:** update dependency lru-cache to v7 ([#257](https://github.com/adobe/helix-fetch/issues/257)) ([ce8a3f1](https://github.com/adobe/helix-fetch/commit/ce8a3f1ba3b019282edf87594c96eb13dbfe7678))

## [3.0.3](https://github.com/adobe/helix-fetch/compare/v3.0.2...v3.0.3) (2022-02-04)


### Bug Fixes

* DTS ([c55e58a](https://github.com/adobe/helix-fetch/commit/c55e58a7ad77e681e8633c01c42f4aba1484d867))

## [3.0.2](https://github.com/adobe/helix-fetch/compare/v3.0.1...v3.0.2) (2022-02-03)


### Bug Fixes

* request body cleanup on abort ([#253](https://github.com/adobe/helix-fetch/issues/253)) ([229a05c](https://github.com/adobe/helix-fetch/commit/229a05c0fbcdd130a855c912fc781b2225660db3))

## [3.0.1](https://github.com/adobe/helix-fetch/compare/v3.0.0...v3.0.1) (2022-02-03)


### Bug Fixes

* DTS (issue [#250](https://github.com/adobe/helix-fetch/issues/250)) ([#252](https://github.com/adobe/helix-fetch/issues/252)) ([6ee4081](https://github.com/adobe/helix-fetch/commit/6ee408123bdb1fd6cd42b25adbe22d6effa7f837))

# [3.0.0](https://github.com/adobe/helix-fetch/compare/v2.4.2...v3.0.0) (2021-10-15)


### Features

* reduce dependencies ([#211](https://github.com/adobe/helix-fetch/issues/211)) ([5562f5f](https://github.com/adobe/helix-fetch/commit/5562f5ff170914c2b9ea1a9d7c445b052ae4aaf0))


### BREAKING CHANGES

* FormData is no longer exported by helix-fetch. You can use a spec-compliant
FormData implementation instead (e.g. `formdata-node`)

* feat: setting maxCacheSize = 0 disables cache

* feat: new convenience functions: noCache(), h1(), keepAlive(), h1NoCache(), keepAliveNoCche()

* chore: fix ts declarations

* chore: update deps

## [2.4.2](https://github.com/adobe/helix-fetch/compare/v2.4.1...v2.4.2) (2021-08-18)


### Bug Fixes

* handle server protocol h2->h1 downgrade ([#203](https://github.com/adobe/helix-fetch/issues/203)) ([1526126](https://github.com/adobe/helix-fetch/commit/1526126e7f0346f041a8224bd651f87edbb4b14e))

## [2.4.1](https://github.com/adobe/helix-fetch/compare/v2.4.0...v2.4.1) (2021-07-30)


### Bug Fixes

* add distinct exports for commonjs and esm ([#197](https://github.com/adobe/helix-fetch/issues/197)) ([418b6d3](https://github.com/adobe/helix-fetch/commit/418b6d34f53fe834418f680fddbf93d6f95e4113))

# [2.4.0](https://github.com/adobe/helix-fetch/compare/v2.3.0...v2.4.0) (2021-07-29)


### Features

* **types:** add full typedefs and esm support ([#196](https://github.com/adobe/helix-fetch/issues/196)) ([0859cd3](https://github.com/adobe/helix-fetch/commit/0859cd37fcfc25109290563d5da6508535f28477))

# [2.3.0](https://github.com/adobe/helix-fetch/compare/v2.2.1...v2.3.0) (2021-06-11)


### Features

* timeoutSignal can be canceled ([#187](https://github.com/adobe/helix-fetch/issues/187)) ([d0d25b7](https://github.com/adobe/helix-fetch/commit/d0d25b7f427eb4c956948868b6d9900913ec3eb2))

## [2.2.1](https://github.com/adobe/helix-fetch/compare/v2.2.0...v2.2.1) (2021-05-17)


### Bug Fixes

* properly propagate global rejectUnauthorized context option ([#173](https://github.com/adobe/helix-fetch/issues/173)) ([e61c326](https://github.com/adobe/helix-fetch/commit/e61c326266e99e2af44d26a875539595af336d1a))

# [2.2.0](https://github.com/adobe/helix-fetch/compare/v2.1.9...v2.2.0) (2021-03-26)


### Features

* **core:** use buffer.length for content-length if possible ([#155](https://github.com/adobe/helix-fetch/issues/155)) ([e614297](https://github.com/adobe/helix-fetch/commit/e614297cfd4f7351d2cc0119485de9dcc1838d8b))

## [2.1.9](https://github.com/adobe/helix-fetch/compare/v2.1.8...v2.1.9) (2021-03-25)


### Bug Fixes

* use byte length in content-length ([#154](https://github.com/adobe/helix-fetch/issues/154)) ([cc46f65](https://github.com/adobe/helix-fetch/commit/cc46f6582da4377fd5148d3f72e4a77376f4e825))

## [2.1.8](https://github.com/adobe/helix-fetch/compare/v2.1.7...v2.1.8) (2021-03-22)


### Bug Fixes

* guard against race condition on reset ([72fb3a4](https://github.com/adobe/helix-fetch/commit/72fb3a47210f0e40246acdc41425f9cd9011ceed))

## [2.1.7](https://github.com/adobe/helix-fetch/compare/v2.1.6...v2.1.7) (2021-03-04)


### Bug Fixes

* concurrent h2 requests to same origin using separate contexts ([#148](https://github.com/adobe/helix-fetch/issues/148)) ([ac85163](https://github.com/adobe/helix-fetch/commit/ac851632fc5723dfa4bec59d7e11bec827fe02e5))

## [2.1.6](https://github.com/adobe/helix-fetch/compare/v2.1.5...v2.1.6) (2021-02-25)


### Bug Fixes

* preserve original req body and calculate content-length for non-stream body ([#144](https://github.com/adobe/helix-fetch/issues/144)) ([d4f04e5](https://github.com/adobe/helix-fetch/commit/d4f04e52cc53e9ddf5e0bf1df40ec3937c934cae))

## [2.1.5](https://github.com/adobe/helix-fetch/compare/v2.1.4...v2.1.5) (2021-02-16)


### Bug Fixes

* **deps:** update external major ([#139](https://github.com/adobe/helix-fetch/issues/139)) ([ae0bf92](https://github.com/adobe/helix-fetch/commit/ae0bf92ce3d4ac3c8061d56f60e3946f2bad3c7a))

## [2.1.4](https://github.com/adobe/helix-fetch/compare/v2.1.3...v2.1.4) (2021-02-12)


### Bug Fixes

* **response:** don't set content-type for null body ([#137](https://github.com/adobe/helix-fetch/issues/137)) ([492e74d](https://github.com/adobe/helix-fetch/commit/492e74d1fd7f5b79f7f1253c3ea504d3389e3734))

## [2.1.3](https://github.com/adobe/helix-fetch/compare/v2.1.2...v2.1.3) (2021-02-09)


### Bug Fixes

* **h2:** fixing ERR_HTTP2_SOCKET_BOUND errors ([55213b3](https://github.com/adobe/helix-fetch/commit/55213b3b62dd2e433671135a6eadd1b832795d90)), closes [#135](https://github.com/adobe/helix-fetch/issues/135)

## [2.1.2](https://github.com/adobe/helix-fetch/compare/v2.1.1...v2.1.2) (2021-02-04)


### Bug Fixes

* don't manipulate location header ([#133](https://github.com/adobe/helix-fetch/issues/133)) ([ae78c75](https://github.com/adobe/helix-fetch/commit/ae78c756ea3ff009fbcc6d1f8827781cb0608917))

## [2.1.1](https://github.com/adobe/helix-fetch/compare/v2.1.0...v2.1.1) (2021-02-04)


### Bug Fixes

* **body:** TypeError on errored stream ([#132](https://github.com/adobe/helix-fetch/issues/132)) ([a801d79](https://github.com/adobe/helix-fetch/commit/a801d7948f2f070d94f8c9f1ba64e6bdd9239dd5))

# [2.1.0](https://github.com/adobe/helix-fetch/compare/v2.0.1...v2.1.0) (2021-01-28)


### Features

* **response:** guess Response content-type ([#128](https://github.com/adobe/helix-fetch/issues/128)) ([0cff243](https://github.com/adobe/helix-fetch/commit/0cff2434cc90bc007bff078f2685a6cfc4bcae43)), closes [#122](https://github.com/adobe/helix-fetch/issues/122)

## [2.0.1](https://github.com/adobe/helix-fetch/compare/v2.0.0...v2.0.1) (2021-01-26)


### Bug Fixes

* **types:** add missing exported types ([#121](https://github.com/adobe/helix-fetch/issues/121)) ([0e72a4d](https://github.com/adobe/helix-fetch/commit/0e72a4d751fc91528af592b16b0e337bdd19e8f1))

# [2.0.0](https://github.com/adobe/helix-fetch/compare/v1.9.2...v2.0.0) (2021-01-25)


### Features

* rewrite from scratch [BREAKING CHANGES] ([#116](https://github.com/adobe/helix-fetch/issues/116)) ([75cbcbe](https://github.com/adobe/helix-fetch/commit/75cbcbe7b43af5a16531db2691994a8f25a740a3)), closes [#20](https://github.com/adobe/helix-fetch/issues/20) [#27](https://github.com/adobe/helix-fetch/issues/27) [#32](https://github.com/adobe/helix-fetch/issues/32) [#81](https://github.com/adobe/helix-fetch/issues/81)


### BREAKING CHANGES

* ** The exposed API, options etc have been aligned with node-fetch. Due to the major
changes there are numerous breaking changes both in the API and the options. See the [1.x to 2.x Upgrade Guide](v2-UPGRADE-GUIDE.md) for details.

## [1.9.2](https://github.com/adobe/helix-fetch/compare/v1.9.1...v1.9.2) (2020-12-09)


### Bug Fixes

* **index:** workaround for persistent ERR_HTTP2_INVALID_SESSION errors ([1cc78b3](https://github.com/adobe/helix-fetch/commit/1cc78b3372f1ed00561b7e88a3554878b72530a7)), closes [#103](https://github.com/adobe/helix-fetch/issues/103)

## [1.9.1](https://github.com/adobe/helix-fetch/compare/v1.9.0...v1.9.1) (2020-08-10)


### Bug Fixes

* **deps:** update dependency get-stream to v6 ([1f18b4e](https://github.com/adobe/helix-fetch/commit/1f18b4e12db490cd67b24a3e422f252141dea6fb))

# [1.9.0](https://github.com/adobe/helix-fetch/compare/v1.8.1...v1.9.0) (2020-08-03)


### Features

* support URLSearchParams and FormData as body ([a8cfa92](https://github.com/adobe/helix-fetch/commit/a8cfa92a96d15434b809aea9b45e969de63735a9)), closes [#67](https://github.com/adobe/helix-fetch/issues/67)

## [1.8.1](https://github.com/adobe/helix-fetch/compare/v1.8.0...v1.8.1) (2020-07-22)


### Bug Fixes

* follow redirects by default ([d5901fe](https://github.com/adobe/helix-fetch/commit/d5901fec23e57ed5d4f6ae91c7dea8b8cdd9ee26)), closes [#79](https://github.com/adobe/helix-fetch/issues/79)

# [1.8.0](https://github.com/adobe/helix-fetch/compare/v1.7.1...v1.8.0) (2020-07-20)


### Features

* replace references to "master" branch with "main" ([ad9f254](https://github.com/adobe/helix-fetch/commit/ad9f254641867dabbd531861b45b7f8be12392f5)), closes [#77](https://github.com/adobe/helix-fetch/issues/77)

## [1.7.1](https://github.com/adobe/helix-fetch/compare/v1.7.0...v1.7.1) (2020-07-13)


### Bug Fixes

* **deps:** update dependency lru-cache to v6 ([a41d842](https://github.com/adobe/helix-fetch/commit/a41d842db007d93eaecb18a3c9fba1fb7833c25b))

# [1.7.0](https://github.com/adobe/helix-fetch/compare/v1.6.2...v1.7.0) (2020-06-30)


### Features

* support AbortController for aborting fetch operations ([bb06b3e](https://github.com/adobe/helix-fetch/commit/bb06b3e866377f0a3d1e52a9c9310a7500441411)), closes [#64](https://github.com/adobe/helix-fetch/issues/64)

## [1.6.2](https://github.com/adobe/helix-fetch/compare/v1.6.1...v1.6.2) (2020-06-15)


### Bug Fixes

* explicitly set Host header ([331fcc9](https://github.com/adobe/helix-fetch/commit/331fcc98a43c779b4b385ba3b32d8b612aa057a8)), closes [#52](https://github.com/adobe/helix-fetch/issues/52)

## [1.6.1](https://github.com/adobe/helix-fetch/compare/v1.6.0...v1.6.1) (2020-05-14)


### Bug Fixes

* make sure returned Response is wrapped ([5b7c0d7](https://github.com/adobe/helix-fetch/commit/5b7c0d7afb13ac3df55c153c5e053451926aaaf5)), closes [#41](https://github.com/adobe/helix-fetch/issues/41)

# [1.6.0](https://github.com/adobe/helix-fetch/compare/v1.5.0...v1.6.0) (2020-04-02)


### Features

* **index:** support array-type query param values ([fc07e7c](https://github.com/adobe/helix-fetch/commit/fc07e7c25c4b3f3e5329fde153598cb0e4ea41d8)), closes [#14](https://github.com/adobe/helix-fetch/issues/14)

# [1.5.0](https://github.com/adobe/helix-fetch/compare/v1.4.2...v1.5.0) (2020-03-27)


### Features

* **index:** allow queryParams ([961b3a2](https://github.com/adobe/helix-fetch/commit/961b3a2febabb05bd11ea5ff9a256801853ba9fe))
* **index:** query strings allowed ([a776286](https://github.com/adobe/helix-fetch/commit/a776286caa0734336bbbe683dd9e411aa9d7c7a8)), closes [#12](https://github.com/adobe/helix-fetch/issues/12)
* **index:** querystring support ([45da799](https://github.com/adobe/helix-fetch/commit/45da7990a29a1f6f185760e4758fbd0319cc59c0)), closes [#11](https://github.com/adobe/helix-fetch/issues/11)
* minor tweaks and added test ([6c41275](https://github.com/adobe/helix-fetch/commit/6c41275d5b2019e62ad37fcdaaa24972365c0d8f)), closes [#11](https://github.com/adobe/helix-fetch/issues/11)

## [1.4.2](https://github.com/adobe/helix-fetch/compare/v1.4.1...v1.4.2) (2020-03-24)


### Bug Fixes

* **index:** sanitize method name ([fc539e1](https://github.com/adobe/helix-fetch/commit/fc539e1cf740a148e0371b76dbbf69811bdf1d5f)), closes [#24](https://github.com/adobe/helix-fetch/issues/24)

## [1.4.1](https://github.com/adobe/helix-fetch/compare/v1.4.0...v1.4.1) (2020-03-17)


### Performance Improvements

* bumped fetch-h2 dependency and some housekeeping ([db66e1e](https://github.com/adobe/helix-fetch/commit/db66e1e0240ac7626ff911ea970e073d9f4e3a45)), closes [#14](https://github.com/adobe/helix-fetch/issues/14)

# [1.4.0](https://github.com/adobe/helix-fetch/compare/v1.3.0...v1.4.0) (2020-02-28)


### Features

* make cache size limit configurable ([7fd632d](https://github.com/adobe/helix-fetch/commit/7fd632df0f875b701156132be58e68b8f9c37526)), closes [#9](https://github.com/adobe/helix-fetch/issues/9)

# [1.3.0](https://github.com/adobe/helix-fetch/compare/v1.2.0...v1.3.0) (2020-02-28)


### Features

* option to force HTTP/1(.1) protocol ([501d6a2](https://github.com/adobe/helix-fetch/commit/501d6a2fb08fe08657238ea4ee7e558caef392fd)), closes [#8](https://github.com/adobe/helix-fetch/issues/8)

# [1.2.0](https://github.com/adobe/helix-fetch/compare/v1.1.0...v1.2.0) (2020-02-27)


### Features

* expose fetch context to allow custom configuration ([6be0b6c](https://github.com/adobe/helix-fetch/commit/6be0b6cdb172702d2f4068cc632dd9f2643072da)), closes [#15](https://github.com/adobe/helix-fetch/issues/15)

# [1.1.0](https://github.com/adobe/helix-fetch/compare/v1.0.0...v1.1.0) (2020-02-03)


### Features

* support timeout on fetch requests; doc and test ([ce6c1ce](https://github.com/adobe/helix-fetch/commit/ce6c1cea8ae204de232447e97e2b98bbd4f0fd3a)), closes [#1](https://github.com/adobe/helix-fetch/issues/1)

# 1.0.0 (2020-01-31)


### Bug Fixes

* **package.json:** trigger initial release ([1280c16](https://github.com/adobe/helix-fetch/commit/1280c160bedfbd71acb9e1baf20013226386dd92))
