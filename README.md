# Compatibility

This cartridge is compatible with Storefront Reference Architecture (SFRA) version 7.0.1

# Getting Started

1. Navigate to the link-nuvei folder and edit the package.json file.

2. Ensure the base path is correctly resolved to the app_storefront_base, as shown below:
```
"paths":{
  "base":"../storefront-reference-architecture/cartridges/app_storefront_base/"
}
```

3. Run `npm install` to install all of the local dependencies (it has been tested with Node v18.19 and is recommended)

4. Run `npm run build` from the command line that would compile all client-side JS and CSS files.

5. Create `dw.json` file in the root of the project.

```json
{
    "hostname": "your-sandbox-hostname.demandware.net",
    "username": "your-login",
    "password": "your-pwd",
    "code-version": "version_to_upload_to"
}
```
