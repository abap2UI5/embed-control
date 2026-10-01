@AbapCatalog.viewEnhancementCategory: [#NONE]
@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'abap2UI5 embed control - countries'
@Metadata.allowExtensions: true
@Metadata.ignorePropagatedAnnotations: true
@ObjectModel.usageType:{
    serviceQuality: #X,
    sizeCategory: #S,
    dataClass: #MIXED
}
define view entity Z2UI5_C_EMBED_COUNTRY
  as select from t005t
{
      @EndUserText.label: 'Country'
  key land1 as Country,

      @EndUserText.label: 'Name'
      landx as CountryName,

      @EndUserText.label: 'Nationality'
      natio as Nationality,

      @EndUserText.label: 'Language'
      spras as Language
}
where
  spras = $session.system_language
