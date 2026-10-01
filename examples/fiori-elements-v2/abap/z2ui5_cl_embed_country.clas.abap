"! The abap2UI5 app of the Fiori elements example for OData V2: the object
"! page extension of the app starts it with three fields of the country on the
"! page as startup parameters (ext/Abap2UI5Section.js), and it reads that
"! country again from the CDS view the RAP service exposes. It shows both - what
"! the host app sent and what the system has.
CLASS z2ui5_cl_embed_country DEFINITION PUBLIC FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.

    DATA params      TYPE z2ui5_if_client=>ty_t_name_value.
    DATA country     TYPE string.
    DATA name        TYPE string.
    DATA nationality TYPE string.
    DATA read_at     TYPE string.

  PROTECTED SECTION.

  PRIVATE SECTION.
    METHODS read_country.

    METHODS view_display
      IMPORTING
        client TYPE REF TO z2ui5_if_client.

ENDCLASS.


CLASS z2ui5_cl_embed_country IMPLEMENTATION.

  METHOD z2ui5_if_app~main.

    IF client->check_on_init( ).
      " params="{ country: 'AT', language: 'EN', nationality: 'Austrian' }"
      " of the object page extension, and app_start, which named this class
      params = client->get( )-t_comp_params.
      LOOP AT params INTO DATA(param).
        IF to_lower( param-n ) = `country`.
          country = param-v.
        ENDIF.
      ENDLOOP.
      read_country( ).
      view_display( client ).

    ELSEIF client->check_on_navigated( ).
      view_display( client ).

    ELSEIF client->check_on_event( `READ` ).
      read_country( ).
      client->message_toast_display( |{ country } read again at { read_at }| ).
    ENDIF.

  ENDMETHOD.


  METHOD read_country.

    CLEAR: name, nationality.
    SELECT SINGLE FROM z2ui5_c_embed_country
        FIELDS countryname, nationality
        WHERE country = @country
        INTO (@name, @nationality).
    IF sy-subrc <> 0.
      name = |{ country } is not in Z2UI5_C_EMBED_COUNTRY|.
    ENDIF.

    GET TIME STAMP FIELD DATA(now).
    read_at = |{ now TIMESTAMP = ISO }|.

  ENDMETHOD.


  METHOD view_display.

    DATA(view) = z2ui5_cl_ui5_view_builder=>factory(
        )->ele( n = `View` ns = `mvc`
            )->a( n = `xmlns`         v = `sap.m`
            )->a( n = `xmlns:mvc`     v = `sap.ui.core.mvc`
            )->a( n = `xmlns:core`    v = `sap.ui.core`
            )->a( n = `xmlns:form`    v = `sap.ui.layout.form`
            )->a( n = `displayBlock`  v = `true`
            )->a( n = `height`        v = `100%` ).

    DATA(page) = view->ele( `Page`
        )->a( n = `title` v = `abap2UI5 - the country on the object page` ).

    page->ele( n = `SimpleForm` ns = `form`
        )->a( n = `editable` v = `false`
        )->ele( n = `content` ns = `form`
            )->tag( n = `Title` ns = `core`
                )->a( n = `text` v = `Read from Z2UI5_C_EMBED_COUNTRY, the view of the RAP service`
            )->tag( `Label`
                )->a( n = `text` v = `Country`
            )->tag( `Text`
                )->a( n = `text` v = client->_bind( country )
            )->tag( `Label`
                )->a( n = `text` v = `Name`
            )->tag( `Text`
                )->a( n = `text` v = client->_bind( name )
            )->tag( `Label`
                )->a( n = `text` v = `Nationality`
            )->tag( `Text`
                )->a( n = `text` v = client->_bind( nationality )
            )->tag( `Label`
                )->a( n = `text` v = `Read at`
            )->tag( `Text`
                )->a( n = `text` v = client->_bind( read_at )
            )->tag( `Button`
                )->a( n = `text`  v = `Read again`
                )->a( n = `press` v = client->_event( `READ` ) ).

    page->ele( `Table`
        )->a( n = `headerText` v = `Startup parameters, as the host app sent them`
        )->a( n = `items`      v = client->_bind( params )
        )->ele( `columns`
            )->ele( `Column`
                )->tag( `Text`
                    )->a( n = `text` v = `Name`
            )->end(
            )->ele( `Column`
                )->tag( `Text`
                    )->a( n = `text` v = `Value`
            )->end(
        )->end(
        )->ele( `items`
            )->ele( `ColumnListItem`
                )->ele( `cells`
                    )->tag( `Text`
                        )->a( n = `text` v = `{N}`
                    )->tag( `Text`
                        )->a( n = `text` v = `{V}` ).

    client->view_display( view->stringify( ) ).

  ENDMETHOD.

ENDCLASS.
