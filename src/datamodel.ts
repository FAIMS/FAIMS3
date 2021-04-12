export interface ConnectionInfo {
    proto: string;
    host: string;
    port: number;
    lan?: boolean;
    db_name: string;
}

export interface ListingsObject {
    _id: string;
    name: string;
    description: string;
    projects_db?: ConnectionInfo;
    people_db?: ConnectionInfo;
}

export interface NonNullListingsObject extends ListingsObject {
    projects_db: ConnectionInfo;
    people_db: ConnectionInfo;
}

export interface ActiveDoc {
    _id: string;
    listing_id: string;
    project_id: string;
    username: string;
    password: string;
}

/**
 * Describes a project, with connection, name, description, and schema
 * Part of the Projects DB
 */
export interface ProjectObject {
    _id: string;
    name: string;
    description: string;
    data_db?: ConnectionInfo;
    metadata_db?: ConnectionInfo;
}


/*
 * Objects that may be contained in a Project's metadata DB
 */
export interface ProjectSchema {
    _id: string;
}

export interface ProjectUIModel {
    _id: string;
}

export interface ProjectPeople {
    _id: string;
}

export interface Observation {
    _id: string;
}

/*
 * Elements of a Project's metadataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectMetaObject = ProjectSchema | ProjectUIModel | ProjectPeople;

/**
 * Document from a people DB
 */
export interface PeopleDoc {

}

export interface ProjectDoc {
    
}