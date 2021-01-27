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
